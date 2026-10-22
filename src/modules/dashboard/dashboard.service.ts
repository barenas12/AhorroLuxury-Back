import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export class DashboardService {
  async getFinancialSummary(): Promise<any> {
    // 1. Total recaudado por método
    const paymentsQuery = `
      SELECT 
        \`paymentMethod\`, \`concept\`,
        COALESCE(SUM(\`amount\`), 0) as \`totalAmount\`,
        COALESCE(SUM(\`fineAmount\`), 0) as \`totalFines\`
      FROM \`payments\` GROUP BY \`paymentMethod\`, \`concept\`
    `
    // 2. TOTAL EGRESOS (Lo nuevo que restaremos de la caja)
    const egressesQuery = `
      SELECT 
        \`paymentMethod\`, COALESCE(SUM(\`amount\`), 0) as \`totalEgress\`
      FROM \`egresses\` GROUP BY \`paymentMethod\`
    `
    // 3. Histórico de préstamos
    const loansQuery = `
      SELECT COALESCE(SUM(\`initialCapital\`), 0) as \`totalLent\`
      FROM \`loans\` WHERE \`status\` != 'Anulado'
    `

    const [paymentsRows] = await dbPool.execute<RowDataPacket[]>(paymentsQuery)
    const [egressesRows] = await dbPool.execute<RowDataPacket[]>(egressesQuery)
    const [loansRows] = await dbPool.execute<RowDataPacket[]>(loansQuery)

    return {
      recaudo: paymentsRows,
      salidas: egressesRows, // Le enviamos los egresos al frontend
      capitalPrestadoTotal: Number(loansRows[0]?.totalLent || 0)
    }
  }
}