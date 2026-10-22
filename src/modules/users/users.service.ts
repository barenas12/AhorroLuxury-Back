
import { RowDataPacket } from 'mysql2'
import bcrypt from 'bcrypt'
import { dbPool } from '../../shared/config/database'

export interface CreateUserDTO {
  documentId: string
  name: string
  lastName: string
  savingsValue: number
  frequency: number
  cellphone: number
  coordinator: number
  profile: number
  canLogin: boolean
  ticket?: string[] | string
  ticket2?: string[] | string
}

export interface UpdateUserDTO {
  id: number
  documentId: string
  name: string
  lastName: string
  savingsValue: number
  frequency: number
  cellphone: number
  coordinator: number
  profile: number
  canLogin: boolean
  ticket?: string[] | string
  ticket2?: string[] | string
}

export class UsersService {
  // Función auxiliar para normalizar y validar boletas (00 a 99)
  private normalizeAndValidateTickets(rawTickets: string[] | string | undefined, raffleLabel: string): string[] {
    if (!rawTickets) return []

    let ticketsArray: string[] = []
    if (typeof rawTickets === 'string') {
      try {
        ticketsArray = JSON.parse(rawTickets)
      } catch {
        ticketsArray = rawTickets.split(',').map((t) => t.trim())
      }
    } else if (Array.isArray(rawTickets)) {
      ticketsArray = rawTickets
    }

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

    return cleaned
  }

  // Valida que los números no estén tomados por otro socio en la columna específica
  private async checkTicketsAvailability(
    tickets: string[], 
    columnName: 'ticket' | 'ticket2', 
    raffleName: string, 
    excludePartnerId?: number
  ): Promise<void> {
    if (tickets.length === 0) return

    let query = `SELECT \`id\`, \`name\`, \`lastName\`, \`${columnName}\` AS \`ticketsField\` FROM \`partners\` WHERE \`${columnName}\` IS NOT NULL AND \`${columnName}\` != ''`
    const params: any[] = []

    if (excludePartnerId) {
      query += ` AND \`id\` != ?`
      params.push(excludePartnerId)
    }

    const [rows] = await dbPool.execute<RowDataPacket[]>(query, params)

    for (const row of rows) {
      let existingTickets: string[] = []
      try {
        existingTickets = JSON.parse(row.ticketsField)
      } catch {
        existingTickets = typeof row.ticketsField === 'string' ? row.ticketsField.split(',') : []
      }

      for (const t of tickets) {
        if (existingTickets.includes(t)) {
          throw new Error(`La boleta "${t}" en ${raffleName} ya está asignada a ${row.name} ${row.lastName}.`)
        }
      }
    }
  }

  // 1. Obtener socios con ambos campos de boletas
  async getAllUsers(partnerStatusFilter?: number): Promise<RowDataPacket[]> {
    let query = `
      SELECT 
        p.\`id\`,
        p.\`documentId\`,
        p.\`name\`,
        p.\`lastName\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`savingsValue\`,
        p.\`frequency\`,
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
    return rows
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

  // 3. Crear usuario con ticket y ticket2 independientes
  async createUser(data: CreateUserDTO): Promise<void> {
    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    await this.checkTicketsAvailability(tickets1, 'ticket', 'Rifa 1')
    await this.checkTicketsAvailability(tickets2, 'ticket2', 'Rifa 2')

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)

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
          \`documentId\`, \`name\`, \`lastName\`, \`savingsValue\`, \`frequency\`, \`cellphone\`, 
          \`coordinator\`, \`ticket\`, \`ticket2\`, \`status\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `
      await connection.execute(partnerQuery, [
        data.documentId.trim(),
        data.name.trim(),
        data.lastName.trim(),
        data.savingsValue,
        data.frequency,
        data.cellphone,
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

  // 4. Actualizar usuario con ticket y ticket2 independientes
  async updateUser(data: UpdateUserDTO): Promise<void> {
    const tickets1 = this.normalizeAndValidateTickets(data.ticket, 'Rifa 1')
    const tickets2 = this.normalizeAndValidateTickets(data.ticket2, 'Rifa 2')

    await this.checkTicketsAvailability(tickets1, 'ticket', 'Rifa 1', data.id)
    await this.checkTicketsAvailability(tickets2, 'ticket2', 'Rifa 2', data.id)

    const ticketJson1 = JSON.stringify(tickets1)
    const ticketJson2 = JSON.stringify(tickets2)

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
            \`frequency\` = ?, \`cellphone\` = ?, \`coordinator\` = ?, \`ticket\` = ?, \`ticket2\` = ?
        WHERE \`id\` = ?
      `
      await connection.execute(updatePartnerQuery, [
        data.documentId.trim(),
        data.name.trim(),
        data.lastName.trim(),
        data.savingsValue,
        data.frequency,
        data.cellphone,
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

  // 5. Consulta de Cuadrícula de Rifa (00 al 99)
  async getRaffleBoard(raffleType: '1' | '2'): Promise<any[]> {
    const column = raffleType === '2' ? 'ticket2' : 'ticket'
    const query = `
      SELECT 
        \`id\`, 
        \`documentId\`, 
        CONCAT_WS(' ', \`name\`, \`lastName\`) AS \`fullName\`,
        \`cellphone\`,
        \`${column}\` AS \`tickets\`
      FROM \`partners\`
      WHERE \`status\` = 1 AND \`${column}\` IS NOT NULL AND \`${column}\` != ''
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)

    // Mapa de 00 al 99
    const board: any[] = []
    for (let i = 0; i <= 99; i++) {
      const numStr = i.toString().padStart(2, '0')
      board.push({
        number: numStr,
        isAssigned: false,
        partner: null
      })
    }

    for (const row of rows) {
      let partnerTickets: string[] = []
      try {
        partnerTickets = JSON.parse(row.tickets)
      } catch {
        partnerTickets = typeof row.tickets === 'string' ? row.tickets.split(',') : []
      }

      for (const t of partnerTickets) {
        const index = parseInt(t, 10)
        if (index >= 0 && index <= 99 && board[index]) {
          board[index].isAssigned = true
          board[index].partner = {
            id: row.id,
            documentId: row.documentId,
            fullName: row.fullName,
            cellphone: row.cellphone
          }
        }
      }
    }

    return board
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