import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import bcrypt from 'bcrypt'
import { dbPool } from '../../shared/config/database'
import { calculateQuotaByFrequency, formatDateOnly } from '../../shared/utils/date.utils'
import { ViewerScope } from '../../shared/utils/scope.utils'
import { AppError } from '../../shared/errors/AppError'
import { AuthUser } from '../../shared/middlewares/auth.middleware'
import {
  generateTemporaryPassword,
  validatePasswordStrength
} from '../../shared/utils/password.utils'

const BCRYPT_ROUNDS = 12

export interface CreateUserDTO {
  documentId: string
  name: string
  lastName: string
  savingsValue: number
  frequency: number
  savingsStartDate?: string | null
  cellphone: number | string
  coordinator: number
  profile: number
  canLogin: boolean
  ticket?: string[] | string
  ticket2?: string[] | string
}

export interface UpdateUserDTO extends CreateUserDTO {
  id: number
}

export interface AssignRaffleTicketDTO {
  ticketNumber: string
  assigneeType: 'partner' | 'external'
  partnerId?: number
  fullName?: string
  cellphone?: string | number
  coordinatorId?: number
}

export class UsersService {
  private parseTicketsSafe(raw: string | string[] | null | undefined): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean)
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean)
      return []
    } catch {
      return String(raw).split(',').map((t) => t.trim()).filter(Boolean)
    }
  }

  private normalizeAndValidateTickets(
    rawTickets: string[] | string | undefined,
    raffleLabel: string
  ): string[] {
    if (!rawTickets) return []
    const ticketsArray = this.parseTicketsSafe(rawTickets)

    const cleaned: string[] = []
    for (const item of ticketsArray) {
      if (item === '') continue
      const num = parseInt(item, 10)
      if (isNaN(num) || num < 0 || num > 99) {
        throw new AppError(
          `El número "${item}" en ${raffleLabel} es inválido. Debe estar entre 00 y 99.`,
          400
        )
      }
      const formatted = num.toString().padStart(2, '0')
      if (cleaned.includes(formatted)) {
        throw new AppError(
          `El número "${formatted}" está repetido para este usuario en ${raffleLabel}.`,
          400
        )
      }
      cleaned.push(formatted)
    }

    cleaned.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    return cleaned
  }

  // Valida disponibilidad dentro de la misma conexión/transacción para evitar condiciones de carrera
  private async checkTicketsAvailability(
    executor: PoolConnection,
    tickets: string[],
    columnName: 'ticket' | 'ticket2',
    raffleName: string,
    excludePartnerId?: number
  ): Promise<void> {
    if (tickets.length === 0) return

    const raffleType = columnName === 'ticket2' ? 2 : 1

    let query = `
      SELECT \`id\`, \`name\`, \`lastName\`, \`${columnName}\` AS \`ticketsField\`
      FROM \`partners\`
      WHERE COALESCE(\`status\`, 1) = 1
        AND \`${columnName}\` IS NOT NULL
        AND \`${columnName}\` != ''
    `
    const params: (string | number)[] = []

    if (excludePartnerId) {
      query += ` AND \`id\` != ?`
      params.push(excludePartnerId)
    }

    const [rows] = await executor.execute<RowDataPacket[]>(query, params)

    for (const row of rows) {
      const existingTickets = this.parseTicketsSafe(row.ticketsField)
      for (const t of tickets) {
        if (existingTickets.includes(t)) {
          throw new AppError(
            `La boleta "${t}" en ${raffleName} ya está asignada a ${row.name} ${row.lastName}.`,
            409
          )
        }
      }
    }

    const [extRows] = await executor.execute<RowDataPacket[]>(
      `SELECT \`ticketNumber\`, \`fullName\` FROM \`raffle_external_tickets\` WHERE \`raffleType\` = ?`,
      [raffleType]
    )

    for (const ext of extRows) {
      const formattedExt = String(ext.ticketNumber).padStart(2, '0')
      if (tickets.includes(formattedExt)) {
        throw new AppError(
          `La boleta "${formattedExt}" en ${raffleName} ya está asignada a ${ext.fullName} (Externo).`,
          409
        )
      }
    }
  }

  async getAllUsers(partnerStatusFilter?: number, scope?: ViewerScope): Promise<any[]> {
    let query = `
      SELECT 
        p.\`id\`,
        p.\`documentId\`,
        p.\`name\`,
        p.\`lastName\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`savingsValue\`,
        p.\`frequency\`,
        DATE_FORMAT(p.\`savingsStartDate\`, '%Y-%m-%d') AS \`savingsStartDate\`,
        DATE_FORMAT(p.\`savingsUpToDateAt\`, '%Y-%m-%d') AS \`savingsUpToDateAt\`,
        p.\`statusValue\`,
        p.\`statusTicket\`,
        p.\`cellphone\`,
        p.\`coordinator\`,
        p.\`ticket\`,
        p.\`ticket2\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`,
        COALESCE(p.\`status\`, 1) AS \`partnerStatus\`,
        COALESCE(u.\`profile\`, 3) AS \`profile\`,
        COALESCE(u.\`status\`, 0) AS \`userLoginStatus\`,
        COALESCE(u.\`resetPassword\`, 0) AS \`resetPassword\`
      FROM \`partners\` p
      LEFT JOIN (
        SELECT
          CAST(\`user\` AS CHAR(100)) AS \`userDoc\`,
          MIN(\`profile\`) AS \`profile\`,
          MAX(\`status\`) AS \`status\`,
          MAX(\`resetPassword\`) AS \`resetPassword\`
        FROM \`users\`
        GROUP BY CAST(\`user\` AS CHAR(100))
      ) u ON CAST(p.\`documentId\` AS CHAR(100)) = u.\`userDoc\`
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
    `
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (partnerStatusFilter !== undefined && !isNaN(partnerStatusFilter)) {
      conditions.push(`COALESCE(p.\`status\`, 1) = ?`)
      params.push(partnerStatusFilter)
    }

    if (scope && scope.profile === 3) {
      if (!scope.ownPartnerId) return []
      conditions.push(`p.\`id\` = ?`)
      params.push(scope.ownPartnerId)
    } else if (scope && scope.profile === 2) {
      const scopeClauses: string[] = []
      if (scope.ownPartnerId) {
        scopeClauses.push(`p.\`id\` = ?`)
        params.push(scope.ownPartnerId)
      }
      if (scope.userId) {
        scopeClauses.push(`p.\`coordinator\` = ?`)
        params.push(scope.userId)
      }
      if (scopeClauses.length === 0) return []
      conditions.push(`(${scopeClauses.join(' OR ')})`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')} `
    }

    query += ` ORDER BY p.\`id\` DESC `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query, params)

    return rows.map((row) => ({
      ...row,
      quotaValue: calculateQuotaByFrequency(
        Number(row.savingsValue || 0),
        Number(row.frequency || 30)
      )
    }))
  }

  async getCoordinators(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        \`id\`, 
        CONCAT_WS(' ', \`name\`, \`lastName\`) AS \`fullName\`,
        \`profile\`
      FROM \`users\`
      WHERE \`profile\` IN (1, 2) AND \`status\` = 1
      ORDER BY \`name\` ASC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  async createUser(data: CreateUserDTO): Promise<{ temporaryPassword: string }> {
    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)
    const startDate = formatDateOnly(data.savingsStartDate)

    const temporaryPassword = generateTemporaryPassword(12)
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS)

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      await this.checkTicketsAvailability(connection, tickets1, 'ticket', 'Rifa 1')
      await this.checkTicketsAvailability(connection, tickets2, 'ticket2', 'Rifa 2')

      const [existing] = await connection.execute<RowDataPacket[]>(
        `SELECT \`id\` FROM \`users\` WHERE \`user\` = ? LIMIT 1`,
        [data.documentId.trim()]
      )

      if (existing.length > 0) {
        throw new AppError('El documento ya se encuentra registrado.', 409)
      }

      const partnerQuery = `
        INSERT INTO \`partners\` (
          \`documentId\`, \`name\`, \`lastName\`, \`savingsValue\`, \`frequency\`, \`savingsStartDate\`,
          \`cellphone\`, \`coordinator\`, \`ticket\`, \`ticket2\`, \`statusValue\`, \`statusTicket\`, \`status\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Al día', 'Al día', 1)
      `
      await connection.execute(partnerQuery, [
        data.documentId.trim(),
        data.name.trim(),
        data.lastName.trim(),
        data.savingsValue,
        data.frequency,
        startDate,
        String(data.cellphone || ''),
        data.coordinator,
        ticketJson1,
        ticketJson2
      ])

      const userStatus = data.canLogin ? 1 : 0
      const userQuery = `
        INSERT INTO \`users\` (
          \`name\`, \`lastName\`, \`profile\`, \`user\`, \`password\`, \`resetPassword\`, \`status\`
        ) VALUES (?, ?, ?, ?, ?, 1, ?)
      `
      await connection.execute(userQuery, [
        data.name.trim(),
        data.lastName.trim(),
        data.profile,
        data.documentId.trim(),
        hashedPassword,
        userStatus
      ])

      await connection.commit()
      return { temporaryPassword }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async updateUser(data: UpdateUserDTO): Promise<void> {
    if (!data.id || isNaN(Number(data.id))) {
      throw new AppError('ID de socio inválido.', 400)
    }

    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)
    const startDate = formatDateOnly(data.savingsStartDate)

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      await this.checkTicketsAvailability(connection, tickets1, 'ticket', 'Rifa 1', data.id)
      await this.checkTicketsAvailability(connection, tickets2, 'ticket2', 'Rifa 2', data.id)

      const [currentPartner] = await connection.execute<RowDataPacket[]>(
        `SELECT \`documentId\` FROM \`partners\` WHERE \`id\` = ? LIMIT 1`,
        [data.id]
      )

      if (!currentPartner || currentPartner.length === 0) {
        throw new AppError('Socio no encontrado.', 404)
      }

      const oldDoc = String(currentPartner[0].documentId)
      const newDoc = data.documentId.trim()

      if (oldDoc !== newDoc) {
        const [dup] = await connection.execute<RowDataPacket[]>(
          `SELECT \`id\` FROM \`users\` WHERE \`user\` = ? LIMIT 1`,
          [newDoc]
        )
        if (dup.length > 0) {
          throw new AppError('El nuevo documento ya pertenece a otro usuario.', 409)
        }
      }

      const updatePartnerQuery = `
        UPDATE \`partners\`
        SET \`documentId\` = ?, \`name\` = ?, \`lastName\` = ?, \`savingsValue\` = ?, 
            \`frequency\` = ?, \`savingsStartDate\` = ?, \`cellphone\` = ?, \`coordinator\` = ?, \`ticket\` = ?, \`ticket2\` = ?
        WHERE \`id\` = ?
      `
      await connection.execute(updatePartnerQuery, [
        newDoc,
        data.name.trim(),
        data.lastName.trim(),
        data.savingsValue,
        data.frequency,
        startDate,
        String(data.cellphone || ''),
        data.coordinator,
        ticketJson1,
        ticketJson2,
        data.id
      ])

      const userLoginStatus = data.canLogin ? 1 : 0
      const updateUserQuery = `
        UPDATE \`users\`
        SET \`name\` = ?, \`lastName\` = ?, \`profile\` = ?, \`user\` = ?, \`status\` = ?
        WHERE \`user\` = ?
      `
      await connection.execute(updateUserQuery, [
        data.name.trim(),
        data.lastName.trim(),
        data.profile,
        newDoc,
        userLoginStatus,
        oldDoc
      ])

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async getRaffleBoard(raffleType: '1' | '2', scope?: ViewerScope): Promise<any[]> {
    const raffleNum = raffleType === '2' ? 2 : 1
    const column = raffleNum === 2 ? 'ticket2' : 'ticket'

    let partnersQuery = `
      SELECT 
        p.\`id\`, 
        p.\`documentId\`, 
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`cellphone\`,
        p.\`coordinator\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`,
        p.\`${column}\` AS \`tickets\`
      FROM \`partners\` p
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
      WHERE COALESCE(p.\`status\`, 1) = 1 AND p.\`${column}\` IS NOT NULL AND p.\`${column}\` != ''
    `
    const partnerParams: (string | number)[] = []

    let externalQuery = `
      SELECT
        e.\`id\`,
        e.\`ticketNumber\`,
        e.\`fullName\`,
        e.\`cellphone\`,
        e.\`coordinatorId\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`
      FROM \`raffle_external_tickets\` e
      LEFT JOIN \`users\` coord ON e.\`coordinatorId\` = coord.\`id\`
      WHERE e.\`raffleType\` = ?
    `
    const externalParams: (string | number)[] = [raffleNum]
    let includeExternals = true

    if (scope && scope.profile === 3) {
      if (!scope.ownPartnerId) return []
      partnersQuery += ` AND p.\`id\` = ? `
      partnerParams.push(scope.ownPartnerId)
      includeExternals = false
    } else if (scope && scope.profile === 2) {
      const clauses: string[] = []
      if (scope.ownPartnerId) {
        clauses.push(`p.\`id\` = ?`)
        partnerParams.push(scope.ownPartnerId)
      }
      if (scope.userId) {
        clauses.push(`p.\`coordinator\` = ?`)
        partnerParams.push(scope.userId)
      }
      if (clauses.length === 0) return []
      partnersQuery += ` AND (${clauses.join(' OR ')}) `

      if (scope.userId) {
        externalQuery += ` AND e.\`coordinatorId\` = ? `
        externalParams.push(scope.userId)
      } else {
        includeExternals = false
      }
    }

    const [partnerRows] = await dbPool.execute<RowDataPacket[]>(partnersQuery, partnerParams)
    const [externalRows] = includeExternals
      ? await dbPool.execute<RowDataPacket[]>(externalQuery, externalParams)
      : ([[]] as unknown as [RowDataPacket[]])

    const [paidRows] = await dbPool.execute<RowDataPacket[]>(
      `
        SELECT \`partnerId\`, \`externalTicketId\`, \`ticketNumber\`, \`raffleType\`
        FROM \`payments\`
        WHERE \`concept\` = 'Pago Boleta'
          AND (\`raffleType\` = ? OR \`raffleType\` IS NULL)
      `,
      [raffleNum]
    )

    const isPartnerTicketPaid = (partnerId: number, ticketNum: string): boolean => {
      return paidRows.some(
        (pay) =>
          Number(pay.partnerId) === partnerId &&
          String(pay.ticketNumber || '').padStart(2, '0') === ticketNum
      )
    }

    const isExternalTicketPaid = (externalTicketId: number, ticketNum: string): boolean => {
      return paidRows.some(
        (pay) =>
          Number(pay.externalTicketId) === externalTicketId ||
          (pay.externalTicketId &&
            String(pay.ticketNumber || '').padStart(2, '0') === ticketNum &&
            Number(pay.raffleType) === raffleNum)
      )
    }

    if (scope && (scope.profile === 2 || scope.profile === 3)) {
      const scopedList: any[] = []

      for (const row of partnerRows) {
        const partnerTickets = this.parseTicketsSafe(row.tickets)
        for (const t of partnerTickets) {
          const index = parseInt(t, 10)
          if (index >= 0 && index <= 99) {
            const numStr = index.toString().padStart(2, '0')
            const isPaid = isPartnerTicketPaid(Number(row.id), numStr)
            scopedList.push({
              number: numStr,
              isAssigned: true,
              assigneeType: 'partner',
              isPaid,
              paymentStatus: isPaid ? 'Al día' : 'En mora',
              partner: {
                id: row.id,
                documentId: row.documentId,
                fullName: row.fullName,
                cellphone: row.cellphone,
                coordinatorName: row.coordinatorName,
                isExternal: false
              }
            })
          }
        }
      }

      for (const ext of externalRows) {
        const index = parseInt(ext.ticketNumber, 10)
        if (index >= 0 && index <= 99) {
          const numStr = index.toString().padStart(2, '0')
          const isPaid = isExternalTicketPaid(Number(ext.id), numStr)
          scopedList.push({
            number: numStr,
            isAssigned: true,
            assigneeType: 'external',
            isPaid,
            paymentStatus: isPaid ? 'Al día' : 'En mora',
            partner: {
              id: ext.id,
              externalTicketId: ext.id,
              documentId: 'Externo',
              fullName: ext.fullName,
              cellphone: ext.cellphone,
              coordinatorId: ext.coordinatorId,
              coordinatorName: ext.coordinatorName,
              isExternal: true
            }
          })
        }
      }

      scopedList.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10))
      return scopedList
    }

    const board: any[] = []
    for (let i = 0; i <= 99; i++) {
      const numStr = i.toString().padStart(2, '0')
      board.push({
        number: numStr,
        isAssigned: false,
        assigneeType: null as 'partner' | 'external' | null,
        isPaid: false,
        paymentStatus: 'Disponible' as 'Disponible' | 'Al día' | 'En mora',
        partner: null
      })
    }

    for (const row of partnerRows) {
      const partnerTickets = this.parseTicketsSafe(row.tickets)
      for (const t of partnerTickets) {
        const index = parseInt(t, 10)
        if (index >= 0 && index <= 99 && board[index]) {
          const numStr = index.toString().padStart(2, '0')
          const isPaid = isPartnerTicketPaid(Number(row.id), numStr)
          board[index].isAssigned = true
          board[index].assigneeType = 'partner'
          board[index].isPaid = isPaid
          board[index].paymentStatus = isPaid ? 'Al día' : 'En mora'
          board[index].partner = {
            id: row.id,
            documentId: row.documentId,
            fullName: row.fullName,
            cellphone: row.cellphone,
            coordinatorName: row.coordinatorName,
            isExternal: false
          }
        }
      }
    }

    for (const ext of externalRows) {
      const index = parseInt(ext.ticketNumber, 10)
      if (index >= 0 && index <= 99 && board[index]) {
        const numStr = index.toString().padStart(2, '0')
        const isPaid = isExternalTicketPaid(Number(ext.id), numStr)
        board[index].isAssigned = true
        board[index].assigneeType = 'external'
        board[index].isPaid = isPaid
        board[index].paymentStatus = isPaid ? 'Al día' : 'En mora'
        board[index].partner = {
          id: ext.id,
          externalTicketId: ext.id,
          documentId: 'Externo',
          fullName: ext.fullName,
          cellphone: ext.cellphone,
          coordinatorId: ext.coordinatorId,
          coordinatorName: ext.coordinatorName,
          isExternal: true
        }
      }
    }

    return board
  }

  async assignRaffleTicket(
    raffleType: '1' | '2',
    data: AssignRaffleTicketDTO
  ): Promise<{ ticketNumber: string; assigneeType: 'partner' | 'external'; id: number }> {
    const raffleNum = raffleType === '2' ? 2 : 1
    const columnName: 'ticket' | 'ticket2' = raffleNum === 2 ? 'ticket2' : 'ticket'
    const raffleLabel = raffleNum === 2 ? 'Rifa 2' : 'Rifa 1'

    const num = parseInt(String(data.ticketNumber || '').trim(), 10)
    if (isNaN(num) || num < 0 || num > 99) {
      throw new AppError(
        `El número "${data.ticketNumber}" es inválido. Debe estar entre 00 y 99.`,
        400
      )
    }
    const formatted = num.toString().padStart(2, '0')

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      await this.checkTicketsAvailability(connection, [formatted], columnName, raffleLabel)

      if (data.assigneeType === 'partner') {
        const partnerId = Number(data.partnerId)
        if (!partnerId) {
          throw new AppError('Debes seleccionar un socio activo para asignar la boleta.', 400)
        }

        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT \`id\`, \`${columnName}\` AS \`ticketsField\` FROM \`partners\` WHERE \`id\` = ? AND COALESCE(\`status\`, 1) = 1 LIMIT 1 FOR UPDATE`,
          [partnerId]
        )
        if (rows.length === 0) {
          throw new AppError('Socio no encontrado o inactivo.', 404)
        }

        const currentTickets = this.parseTicketsSafe(rows[0].ticketsField)
        if (!currentTickets.includes(formatted)) {
          currentTickets.push(formatted)
          currentTickets.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        }

        await connection.execute(
          `UPDATE \`partners\` SET \`${columnName}\` = ? WHERE \`id\` = ?`,
          [JSON.stringify(currentTickets), partnerId]
        )

        await connection.commit()
        return { ticketNumber: formatted, assigneeType: 'partner', id: partnerId }
      }

      if (data.assigneeType === 'external') {
        const fullName = String(data.fullName || '').trim()
        const cellphone = String(data.cellphone || '').trim()
        const coordinatorId = Number(data.coordinatorId)

        if (!fullName || !cellphone || !coordinatorId) {
          throw new AppError(
            'Nombre, celular y coordinador responsable son obligatorios para boletas externas.',
            400
          )
        }

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO \`raffle_external_tickets\` (\`raffleType\`, \`ticketNumber\`, \`fullName\`, \`cellphone\`, \`coordinatorId\`)
           VALUES (?, ?, ?, ?, ?)`,
          [raffleNum, formatted, fullName, cellphone, coordinatorId]
        )

        await connection.commit()
        return { ticketNumber: formatted, assigneeType: 'external', id: result.insertId }
      }

      throw new AppError('Tipo de asignación inválido.', 400)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async togglePartnerStatus(documentId: string, newStatus: number): Promise<void> {
    const [result] = await dbPool.execute<ResultSetHeader>(
      `UPDATE \`partners\` SET \`status\` = ? WHERE \`documentId\` = ?`,
      [newStatus, documentId.trim()]
    )
    if (result.affectedRows === 0) {
      throw new AppError('Socio no encontrado.', 404)
    }
  }

  async resetPassword(documentId: string): Promise<{ temporaryPassword: string }> {
    const cleanDoc = documentId.trim()
    const temporaryPassword = generateTemporaryPassword(12)
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS)

    const [result] = await dbPool.execute<ResultSetHeader>(
      `UPDATE \`users\` SET \`password\` = ?, \`resetPassword\` = 1 WHERE \`user\` = ?`,
      [hashedPassword, cleanDoc]
    )

    if (result.affectedRows === 0) {
      throw new AppError('Usuario no encontrado.', 404)
    }

    return { temporaryPassword }
  }

  async updatePasswordForAuthenticatedUser(
    authUser: AuthUser,
    newPassword: string,
    currentPassword?: string
  ): Promise<void> {
    validatePasswordStrength(newPassword, {
      documentId: authUser.user,
      name: authUser.name,
      lastName: authUser.lastName
    })

    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT \`id\`, \`password\`, \`resetPassword\` FROM \`users\` WHERE \`id\` = ? LIMIT 1`,
      [authUser.id]
    )

    if (!rows || rows.length === 0) {
      throw new AppError('Usuario no encontrado.', 404)
    }

    const record = rows[0]
    const isFirstLoginReset = Number(record.resetPassword) === 1

    // Si NO es cambio obligatorio de primer ingreso, exigir contraseña actual
    if (!isFirstLoginReset) {
      if (!currentPassword) {
        throw new AppError('Debes ingresar tu contraseña actual para cambiarla.', 400)
      }
      const matches = record.password
        ? await bcrypt.compare(currentPassword, String(record.password))
        : false
      if (!matches) {
        throw new AppError('La contraseña actual es incorrecta.', 401)
      }
    }

    // Evitar reutilizar exactamente la misma contraseña actual
    if (record.password) {
      const sameAsOld = await bcrypt.compare(newPassword, String(record.password))
      if (sameAsOld) {
        throw new AppError('La nueva contraseña debe ser diferente a la actual.', 400)
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await dbPool.execute(
      `UPDATE \`users\` SET \`password\` = ?, \`resetPassword\` = 0 WHERE \`id\` = ?`,
      [hashedPassword, authUser.id]
    )
  }
}
