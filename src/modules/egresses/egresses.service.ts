import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface CreateEgressDTO {
  concept: string
  amount: number
  paymentMethod: 'efectivo' | 'transferencia'
  recipient: string // <-- NUEVO CAMPO
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

  async checkAvailableFunds(method: 'efectivo' | 'transferencia', requiredAmount: number): Promise<void> {
    const [incomes]: any = await dbPool.execute(
      'SELECT COALESCE(SUM(\`amount\` + \`fineAmount\`), 0) AS totalIn FROM \`payments\` WHERE \`paymentMethod\` = ?', [method]
    )
    const [egresses]: any = await dbPool.execute(
      'SELECT COALESCE(SUM(\`amount\`), 0) AS totalOut FROM \`egresses\` WHERE \`paymentMethod\` = ?', [method]
    )
    
    const available = Number(incomes[0].totalIn) - Number(egresses[0].totalOut)
    
    if (available < requiredAmount) {
      const availableFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(available)
      throw new Error(`¡Fondos insuficientes en ${method === 'efectivo' ? 'Efectivo' : 'Cuenta'}! Saldo disponible: ${availableFormatted}`)
    }
  }

  async createEgress(data: CreateEgressDTO): Promise<void> {
    if (data.amount <= 0) throw new Error('El valor del egreso debe ser mayor a $0.')
    await this.checkAvailableFunds(data.paymentMethod, data.amount)

    const query = `
      INSERT INTO \`egresses\` (
        \`concept\`, \`amount\`, \`paymentMethod\`, \`recipient\`, \`paymentDate\`, \`observations\`, \`registeredBy\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    await dbPool.execute(query, [
      data.concept, data.amount, data.paymentMethod, data.recipient, data.paymentDate, 
      data.observations || '', data.registeredBy
    ])
  }
}