<<<<<<< HEAD
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface PaymentRowItemDTO {
  concept: string
  ticketNumber?: string | null
  amount: number
  paymentMethod: 'efectivo' | 'transferencia'
  paymentDate: string
  observations?: string
  hasFine: boolean
  fineAmount?: number
}

export interface CreateMultiplePaymentsDTO {
  partnerId: number
  registeredBy: number
  items: PaymentRowItemDTO[]
}

export class PaymentsService {
  // 1. Obtener todos los pagos registrados (incluyendo ticketNumber)
  async getAllPayments(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        pay.\`id\`,
        pay.\`partnerId\`,
        p.\`documentId\` AS \`partnerDocument\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`partnerName\`,
        pay.\`registeredBy\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`,
        pay.\`amount\`,
        pay.\`concept\`,
        pay.\`ticketNumber\`,
        pay.\`paymentMethod\`,
        pay.\`hasFine\`,
        pay.\`fineAmount\`,
        (pay.\`amount\` + pay.\`fineAmount\`) AS \`totalPaid\`,
        DATE_FORMAT(pay.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
        DATE_FORMAT(pay.\`createdAt\`, '%Y-%m-%d %H:%i:%s') AS \`createdAt\`,
        pay.\`observations\`
      FROM \`payments\` pay
      INNER JOIN \`partners\` p ON pay.\`partnerId\` = p.\`id\`
      INNER JOIN \`users\` u ON pay.\`registeredBy\` = u.\`id\`
      ORDER BY pay.\`id\` DESC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  // 2. Traer socios activos incluyendo su lista de boletas (ticket)
  async getActivePartners(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        \`id\`,
        \`documentId\`,
        CONCAT_WS(' ', \`name\`, \`lastName\`) AS \`fullName\`,
        \`savingsValue\`,
        \`ticket\`
      FROM \`partners\`
      WHERE \`status\` = 1
      ORDER BY \`name\` ASC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  // 3. Crear pagos asociando el ticketNumber si existe
  async createMultiplePayments(data: CreateMultiplePaymentsDTO): Promise<void> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Debe ingresar al menos un concepto de pago.')
    }

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      for (const item of data.items) {
        const hasFineFlag = item.hasFine ? 1 : 0
        const fineValue = item.hasFine ? Number(item.fineAmount || 0) : 0
        const ticket = item.concept === 'Pago Boleta' ? (item.ticketNumber || null) : null

        const query = `
          INSERT INTO \`payments\` (
            \`partnerId\`, \`registeredBy\`, \`amount\`, \`concept\`, \`ticketNumber\`,
            \`paymentMethod\`, \`hasFine\`, \`fineAmount\`, \`paymentDate\`, \`observations\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        await connection.execute(query, [
          data.partnerId,
          data.registeredBy,
          item.amount,
          item.concept.trim(),
          ticket,
          item.paymentMethod,
          hasFineFlag,
          fineValue,
          item.paymentDate,
          item.observations ? item.observations.trim() : null
        ])
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
=======
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface PaymentRowItemDTO {
  concept: string
  ticketNumber?: string | null
  amount: number
  paymentMethod: 'efectivo' | 'transferencia'
  paymentDate: string
  observations?: string
  hasFine: boolean
  fineAmount?: number
}

export interface CreateMultiplePaymentsDTO {
  partnerId: number
  registeredBy: number
  items: PaymentRowItemDTO[]
}

export class PaymentsService {
  // 1. Obtener todos los pagos registrados (incluyendo ticketNumber)
  async getAllPayments(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        pay.\`id\`,
        pay.\`partnerId\`,
        p.\`documentId\` AS \`partnerDocument\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`partnerName\`,
        pay.\`registeredBy\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`,
        pay.\`amount\`,
        pay.\`concept\`,
        pay.\`ticketNumber\`,
        pay.\`paymentMethod\`,
        pay.\`hasFine\`,
        pay.\`fineAmount\`,
        (pay.\`amount\` + pay.\`fineAmount\`) AS \`totalPaid\`,
        DATE_FORMAT(pay.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
        DATE_FORMAT(pay.\`createdAt\`, '%Y-%m-%d %H:%i:%s') AS \`createdAt\`,
        pay.\`observations\`
      FROM \`payments\` pay
      INNER JOIN \`partners\` p ON pay.\`partnerId\` = p.\`id\`
      INNER JOIN \`users\` u ON pay.\`registeredBy\` = u.\`id\`
      ORDER BY pay.\`id\` DESC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  // 2. Traer socios activos incluyendo su lista de boletas (ticket)
  async getActivePartners(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        \`id\`,
        \`documentId\`,
        CONCAT_WS(' ', \`name\`, \`lastName\`) AS \`fullName\`,
        \`savingsValue\`,
        \`ticket\`
      FROM \`partners\`
      WHERE \`status\` = 1
      ORDER BY \`name\` ASC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  // 3. Crear pagos asociando el ticketNumber si existe
  async createMultiplePayments(data: CreateMultiplePaymentsDTO): Promise<void> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Debe ingresar al menos un concepto de pago.')
    }

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      for (const item of data.items) {
        const hasFineFlag = item.hasFine ? 1 : 0
        const fineValue = item.hasFine ? Number(item.fineAmount || 0) : 0
        const ticket = item.concept === 'Pago Boleta' ? (item.ticketNumber || null) : null

        const query = `
          INSERT INTO \`payments\` (
            \`partnerId\`, \`registeredBy\`, \`amount\`, \`concept\`, \`ticketNumber\`,
            \`paymentMethod\`, \`hasFine\`, \`fineAmount\`, \`paymentDate\`, \`observations\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        await connection.execute(query, [
          data.partnerId,
          data.registeredBy,
          item.amount,
          item.concept.trim(),
          ticket,
          item.paymentMethod,
          hasFineFlag,
          fineValue,
          item.paymentDate,
          item.observations ? item.observations.trim() : null
        ])
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
}