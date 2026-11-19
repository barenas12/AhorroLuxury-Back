import { ResultSetHeader, RowDataPacket } from 'mysql2'
import bcrypt from 'bcrypt'
import { dbPool } from '../../shared/config/database'
import { calculateQuotaByFrequency, formatDateOnly } from '../../shared/utils/date.utils'

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

  // Función auxiliar para normalizar y validar boletas (00 a 99)
  private normalizeAndValidateTickets(rawTickets: string[] | string | undefined, raffleLabel: string): string[] {
    if (!rawTickets) return []
    const ticketsArray = this.parseTicketsSafe(rawTickets)

    const cleaned: string[] = []
    for (const item of ticketsArray) {
      if (item === '') continue
      const num = parseInt(item, 10)
      if (isNaN(num) || num < 0 || num > 99) {
        throw new Error(`El número "${item}" en ${raffleLabel} es inválido. Debe estar entre 00 y 99.`)
      }
      const formatted = num.toString().padStart(2, '0')
      if (cleaned.includes(formatted)) {
        throw new Error(`El número "${formatted}" está repetido para este usuario en ${raffleLabel}.`)
      }
      cleaned.push(formatted)
    }

    cleaned.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    return cleaned
  }

  // Valida que los números no estén tomados por otro socio activo ni por compradores externos
  private async checkTicketsAvailability(
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
    const params: any[] = []

    if (excludePartnerId) {
      query += ` AND \`id\` != ?`
      params.push(excludePartnerId)
    }

    const [rows] = await dbPool.execute<RowDataPacket[]>(query, params)

    for (const row of rows) {
      const existingTickets = this.parseTicketsSafe(row.ticketsField)
      for (const t of tickets) {
        if (existingTickets.includes(t)) {
          throw new Error(`La boleta "${t}" en ${raffleName} ya está asignada a ${row.name} ${row.lastName}.`)
        }
      }
    }

    // También validar contra boletas externas (compradas por afuera)
    const [extRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT \`ticketNumber\`, \`fullName\` FROM \`raffle_external_tickets\` WHERE \`raffleType\` = ?`,
      [raffleType]
    )

    for (const ext of extRows) {
      const formattedExt = String(ext.ticketNumber).padStart(2, '0')
      if (tickets.includes(formattedExt)) {
        throw new Error(`La boleta "${formattedExt}" en ${raffleName} ya está asignada a ${ext.fullName} (Externo).`)
      }
    }
  }

  // 1. Obtener socios con ambos campos de boletas, fecha inicio y cuota calculada
  async getAllUsers(partnerStatusFilter?: number): Promise<any[]> {
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
      LEFT JOIN \`users\` u ON CAST(p.\`documentId\` AS CHAR(100)) = CAST(u.\`user\` AS CHAR(100))
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
    `
    const params: any[] = []

    if (partnerStatusFilter !== undefined && !isNaN(partnerStatusFilter)) {
      query += ` WHERE COALESCE(p.\`status\`, 1) = ? `
      params.push(partnerStatusFilter)
    }

    query += ` ORDER BY p.\`id\` DESC `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query, params)

    return rows.map((row) => ({
      ...row,
      quotaValue: calculateQuotaByFrequency(Number(row.savingsValue || 0), Number(row.frequency || 30))
    }))
  }

  // 2. Coordinadores
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

  // 3. Crear usuario con ticket, ticket2 y savingsStartDate
  async createUser(data: CreateUserDTO): Promise<void> {
    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    await this.checkTicketsAvailability(tickets1, 'ticket', 'Rifa 1')
    await this.checkTicketsAvailability(tickets2, 'ticket2', 'Rifa 2')

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)
    const startDate = formatDateOnly(data.savingsStartDate)

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      const [existing] = await connection.execute<RowDataPacket[]>(
        `SELECT \`id\` FROM \`users\` WHERE \`user\` = ? LIMIT 1`,
        [data.documentId.trim()]
      )

      if (existing.length > 0) {
        throw new Error('El documento ya se encuentra registrado.')
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

      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(data.documentId.trim(), saltRounds)
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
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  // 4. Actualizar usuario con ticket, ticket2 y savingsStartDate
  async updateUser(data: UpdateUserDTO): Promise<void> {
    if (!data.id || isNaN(Number(data.id))) {
      throw new Error('ID de socio inválido.')
    }

    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    await this.checkTicketsAvailability(tickets1, 'ticket', 'Rifa 1', data.id)
    await this.checkTicketsAvailability(tickets2, 'ticket2', 'Rifa 2', data.id)

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)
    const startDate = formatDateOnly(data.savingsStartDate)

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      const [currentPartner]: any = await connection.execute(
        `SELECT \`documentId\` FROM \`partners\` WHERE \`id\` = ? LIMIT 1`,
        [data.id]
      )

      if (!currentPartner || currentPartner.length === 0) {
        throw new Error('Socio no encontrado.')
      }

      const oldDoc = currentPartner[0].documentId

      const updatePartnerQuery = `
        UPDATE \`partners\`
        SET \`documentId\` = ?, \`name\` = ?, \`lastName\` = ?, \`savingsValue\` = ?, 
            \`frequency\` = ?, \`savingsStartDate\` = ?, \`cellphone\` = ?, \`coordinator\` = ?, \`ticket\` = ?, \`ticket2\` = ?
        WHERE \`id\` = ?
      `
      await connection.execute(updatePartnerQuery, [
        data.documentId.trim(),
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
        data.documentId.trim(),
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

  // 5. Consulta de Cuadrícula de Rifa (00 al 99) incluyendo socios, externos y estado de pago
  async getRaffleBoard(raffleType: '1' | '2'): Promise<any[]> {
    const raffleNum = raffleType === '2' ? 2 : 1
    const column = raffleNum === 2 ? 'ticket2' : 'ticket'

    const partnersQuery = `
      SELECT 
        p.\`id\`, 
        p.\`documentId\`, 
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`cellphone\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`,
        p.\`${column}\` AS \`tickets\`
      FROM \`partners\` p
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
      WHERE COALESCE(p.\`status\`, 1) = 1 AND p.\`${column}\` IS NOT NULL AND p.\`${column}\` != ''
    `
    const [partnerRows] = await dbPool.execute<RowDataPacket[]>(partnersQuery)

    const externalQuery = `
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
    const [externalRows] = await dbPool.execute<RowDataPacket[]>(externalQuery, [raffleNum])

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
          (pay.externalTicketId && String(pay.ticketNumber || '').padStart(2, '0') === ticketNum && Number(pay.raffleType) === raffleNum)
      )
    }

    // Mapa de 00 al 99
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

    // Socios ahorradores
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

    // Compradores externos (por afuera)
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

  // 6. Asignar boleta disponible desde la cuadrícula de rifas (a socio o comprador externo)
  async assignRaffleTicket(raffleType: '1' | '2', data: AssignRaffleTicketDTO): Promise<{ ticketNumber: string; assigneeType: 'partner' | 'external'; id: number }> {
    const raffleNum = raffleType === '2' ? 2 : 1
    const columnName: 'ticket' | 'ticket2' = raffleNum === 2 ? 'ticket2' : 'ticket'
    const raffleLabel = raffleNum === 2 ? 'Rifa 2' : 'Rifa 1'

    const num = parseInt(String(data.ticketNumber || '').trim(), 10)
    if (isNaN(num) || num < 0 || num > 99) {
      throw new Error(`El número "${data.ticketNumber}" es inválido. Debe estar entre 00 y 99.`)
    }
    const formatted = num.toString().padStart(2, '0')

    await this.checkTicketsAvailability([formatted], columnName, raffleLabel)

    if (data.assigneeType === 'partner') {
      const partnerId = Number(data.partnerId)
      if (!partnerId) {
        throw new Error('Debes seleccionar un socio activo para asignar la boleta.')
      }

      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `SELECT \`id\`, \`${columnName}\` AS \`ticketsField\` FROM \`partners\` WHERE \`id\` = ? AND COALESCE(\`status\`, 1) = 1 LIMIT 1`,
        [partnerId]
      )
      if (rows.length === 0) {
        throw new Error('Socio no encontrado o inactivo.')
      }

      const currentTickets = this.parseTicketsSafe(rows[0].ticketsField)
      if (!currentTickets.includes(formatted)) {
        currentTickets.push(formatted)
        currentTickets.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      }

      await dbPool.execute(
        `UPDATE \`partners\` SET \`${columnName}\` = ? WHERE \`id\` = ?`,
        [JSON.stringify(currentTickets), partnerId]
      )

      return { ticketNumber: formatted, assigneeType: 'partner', id: partnerId }
    }

    if (data.assigneeType === 'external') {
      const fullName = String(data.fullName || '').trim()
      const cellphone = String(data.cellphone || '').trim()
      const coordinatorId = Number(data.coordinatorId)

      if (!fullName || !cellphone || !coordinatorId) {
        throw new Error('Nombre, celular y coordinador responsable son obligatorios para boletas externas.')
      }

      const [result] = await dbPool.execute<ResultSetHeader>(
        `INSERT INTO \`raffle_external_tickets\` (\`raffleType\`, \`ticketNumber\`, \`fullName\`, \`cellphone\`, \`coordinatorId\`)
         VALUES (?, ?, ?, ?, ?)`,
        [raffleNum, formatted, fullName, cellphone, coordinatorId]
      )

      return { ticketNumber: formatted, assigneeType: 'external', id: result.insertId }
    }

    throw new Error('Tipo de asignación inválido.')
  }

  // Métodos de estado y reset...
  async togglePartnerStatus(documentId: string, newStatus: number): Promise<void> {
    const query = `UPDATE \`partners\` SET \`status\` = ? WHERE \`documentId\` = ?`
    await dbPool.execute(query, [newStatus, documentId.trim()])
  }

  async resetPassword(documentId: string): Promise<void> {
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(documentId.trim(), saltRounds)
    await dbPool.execute(
      `UPDATE \`users\` SET \`password\` = ?, \`resetPassword\` = 1 WHERE \`user\` = ?`,
      [hashedPassword, documentId.trim()]
    )
  }

  async updatePasswordFirstLogin(username: string, newPass: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPass, 10)
    await dbPool.execute(
      `UPDATE \`users\` SET \`password\` = ?, \`resetPassword\` = 0 WHERE \`user\` = ?`,
      [hashedPassword, username.trim()]
    )
  }
}
