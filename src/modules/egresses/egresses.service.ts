import { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { dbPool } from '../../shared/config/database'
import { AppError } from '../../shared/errors/AppError'

export interface CreateEgressDTO {
  concept: string
  amount: number
  paymentMethod: 'efectivo' | 'transferencia'
  recipient: string
  paymentDate: string
  observations: string
  registeredBy: number
}

export class EgressesService {
  async getAllEgresses(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        e.*, 
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`
      FROM \`egresses\` e
      JOIN \`users\` u ON e.\`registeredBy\` = u.\`id\`
      ORDER BY e.\`paymentDate\` DESC, e.\`id\` DESC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  async checkAvailableFundsOnConnection(
    connection: PoolConnection,
    method: 'efectivo' | 'transferencia',
    requiredAmount: number
  ): Promise<void> {
    const [incomes] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(`amount` + `fineAmount`), 0) AS totalIn FROM `payments` WHERE `paymentMethod` = ?',
      [method]
    )
    const [egresses] = await connection.execute<RowDataPacket[]>(
      'SELECT COALESCE(SUM(`amount`), 0) AS totalOut FROM `egresses` WHERE `paymentMethod` = ?',
      [method]
    )

    const available = Number(incomes[0]?.totalIn || 0) - Number(egresses[0]?.totalOut || 0)

    if (available < requiredAmount) {
      const availableFormatted = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
      }).format(available)
      throw new AppError(
        `¡Fondos insuficientes en ${method === 'efectivo' ? 'Efectivo' : 'Cuenta'}! Saldo disponible: ${availableFormatted}`,
        400
      )
    }
  }

  async createEgress(data: CreateEgressDTO): Promise<void> {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('El valor del egreso debe ser mayor a $0.', 400)
    }

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()
      await this.checkAvailableFundsOnConnection(connection, data.paymentMethod, amount)

      const query = `
        INSERT INTO \`egresses\` (
          \`concept\`, \`amount\`, \`paymentMethod\`, \`recipient\`, \`paymentDate\`, \`observations\`, \`registeredBy\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      await connection.execute(query, [
        data.concept.trim(),
        amount,
        data.paymentMethod,
        data.recipient.trim(),
        data.paymentDate,
        data.observations ? data.observations.trim() : '',
        data.registeredBy
      ])

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
