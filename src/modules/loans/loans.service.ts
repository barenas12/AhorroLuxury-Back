import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface CreateLoanDTO {
  partnerId: number
  initialCapital: number
  interestRate: number
  deliveryMethod: 'efectivo' | 'transferencia'
  guarantee: 'Oro' | 'Prenda' | 'Sin Prenda'
  deliveryDate: string
  termDays: number
  dueDate: string
  installments: number
  observations: string
  registeredBy: number
}

export interface LoanPaymentDTO {
  registeredBy: number
  paymentDate: string
  observations: string
  capitalEfectivo: number
  capitalTransferencia: number
  interesEfectivo: number
  interesTransferencia: number
}

export class LoansService {
  async getAllLoans(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        l.\`id\`, l.\`partnerId\`, l.\`initialCapital\`, l.\`interestRate\`, l.\`deliveryMethod\`, 
        l.\`guarantee\`, l.\`deliveryDate\`, l.\`termDays\`, l.\`dueDate\`, l.\`installments\`, l.\`status\`, l.\`observations\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`partnerName\`,
        p.\`documentId\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`,
        COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Capital Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidCapital\`,
        COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Interés Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidInterest\`
      FROM \`loans\` l
      JOIN \`partners\` p ON l.\`partnerId\` = p.\`id\`
      JOIN \`users\` u ON l.\`registeredBy\` = u.\`id\`
      LEFT JOIN \`payments\` pay ON l.\`id\` = pay.\`loanId\`
      GROUP BY l.\`id\`
      ORDER BY l.\`id\` DESC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  async createLoan(data: CreateLoanDTO): Promise<number> {
    const query = `
      INSERT INTO \`loans\` (
        \`partnerId\`, \`initialCapital\`, \`interestRate\`, \`deliveryMethod\`, 
        \`guarantee\`, \`deliveryDate\`, \`termDays\`, \`dueDate\`, \`installments\`, 
        \`observations\`, \`registeredBy\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const [result] = await dbPool.execute<ResultSetHeader>(query, [
      data.partnerId, data.initialCapital, data.interestRate, data.deliveryMethod,
      data.guarantee, data.deliveryDate, data.termDays, data.dueDate, 
      data.installments || 1, data.observations || '', data.registeredBy
    ])
    return result.insertId
  }

  async registerMixedPayment(loanId: number, data: LoanPaymentDTO): Promise<number[]> {
    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      const insertPaymentQuery = `
        INSERT INTO \`payments\` (
          \`partnerId\`, \`registeredBy\`, \`amount\`, \`concept\`, 
          \`paymentMethod\`, \`paymentDate\`, \`observations\`, \`loanId\`,
          \`hasFine\`, \`fineAmount\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `

      const [loanRows]: any = await connection.execute('SELECT `partnerId`, `initialCapital` FROM `loans` WHERE `id` = ?', [loanId])
      if (loanRows.length === 0) throw new Error('Préstamo no encontrado.')
      const partnerId = loanRows[0].partnerId

      const paymentIds: number[] = []
      const payments = [
        [data.capitalEfectivo, 'Abono Capital Préstamo', 'efectivo'],
        [data.capitalTransferencia, 'Abono Capital Préstamo', 'transferencia'],
        [data.interesEfectivo, 'Abono Interés Préstamo', 'efectivo'],
        [data.interesTransferencia, 'Abono Interés Préstamo', 'transferencia']
      ] as const

      for (const [amount, concept, paymentMethod] of payments) {
        if (amount <= 0) continue
        const [result] = await connection.execute<ResultSetHeader>(insertPaymentQuery, [
          partnerId, data.registeredBy, amount, concept, paymentMethod,
          data.paymentDate, data.observations, loanId
        ])
        paymentIds.push(result.insertId)
      }

      const [sumRows]: any = await connection.execute(
        `SELECT SUM(\`amount\`) AS totalCapitalPaid FROM \`payments\` WHERE \`loanId\` = ? AND \`concept\` = 'Abono Capital Préstamo'`, 
        [loanId]
      )
      
      const totalCapitalPaid = Number(sumRows[0].totalCapitalPaid || 0)
      if (totalCapitalPaid >= Number(loanRows[0].initialCapital)) {
        await connection.execute(`UPDATE \`loans\` SET \`status\` = 'Pagado' WHERE \`id\` = ?`, [loanId])
      }

      await connection.commit()
      return paymentIds
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}