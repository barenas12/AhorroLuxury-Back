import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'
import { ViewerScope } from '../../shared/utils/scope.utils'
import { SavingsService } from '../savings/savings.service'
import { LoansService } from '../loans/loans.service'
import { PaymentsService } from '../payments/payments.service'
import { UsersService } from '../users/users.service'

const savingsService = new SavingsService()
const loansService = new LoansService()
const paymentsService = new PaymentsService()
const usersService = new UsersService()

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
    // 2. TOTAL EGRESOS
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
      salidas: egressesRows,
      capitalPrestadoTotal: Number(loansRows[0]?.totalLent || 0)
    }
  }

  // Resumen personal y de grupo + disponibilidad de módulos para Coordinador (2) y Socio (3)
  async getPersonalSummary(scope: ViewerScope): Promise<any> {
    const [savingsList, loansList, receiptsList, rifa1List, rifa2List, usersList] = await Promise.all([
      savingsService.getSavingsDashboard(scope),
      loansService.getAllLoans(scope),
      paymentsService.getConsolidatedReceipts(scope),
      usersService.getRaffleBoard('1', scope),
      usersService.getRaffleBoard('2', scope),
      scope.profile === 2 ? usersService.getAllUsers(undefined, scope) : Promise.resolve([])
    ])

    const ownPartnerId = scope.ownPartnerId

    // Información personal del usuario en sesión
    const mySavings = ownPartnerId
      ? savingsList.find((s) => Number(s.id) === ownPartnerId) || null
      : null

    const myLoansRows = ownPartnerId
      ? loansList.filter((l) => Number(l.partnerId) === ownPartnerId)
      : []

    const myLoans = {
      totalCount: myLoansRows.length,
      activeCount: myLoansRows.filter((l) => l.status !== 'Pagado' && l.status !== 'Anulado').length,
      totalBorrowed: myLoansRows.reduce((acc, l) => acc + Number(l.initialCapital || 0), 0),
      remainingCapital: myLoansRows.reduce((acc, l) => acc + Number(l.remainingCapital || 0), 0),
      remainingInterest: myLoansRows.reduce((acc, l) => acc + Number(l.remainingInterest || 0), 0),
      paidInterest: myLoansRows.reduce((acc, l) => acc + Number(l.paidInterest || 0), 0)
    }

    const myReceiptsCount = ownPartnerId
      ? receiptsList.filter((r) => Number(r.partnerId) === ownPartnerId).length
      : 0

    // Resumen de socios a cargo (solo Coordinador)
    let teamSummary = null
    if (scope.profile === 2) {
      const assignedSavings = savingsList.filter((s) => Number(s.id) !== ownPartnerId)
      const assignedLoans = loansList.filter((l) => Number(l.partnerId) !== ownPartnerId)
      const externalTicketsCount =
        rifa1List.filter((t) => t.assigneeType === 'external').length +
        rifa2List.filter((t) => t.assigneeType === 'external').length

      teamSummary = {
        assignedPartnersCount: assignedSavings.length,
        totalSaved: assignedSavings.reduce((acc, s) => acc + Number(s.totalSavedCurrentPeriod || 0), 0),
        totalOverdue: assignedSavings.reduce((acc, s) => acc + Number(s.overdueAmount || 0), 0),
        partnersInMoraCount: assignedSavings.filter((s) => s.savingsStatus === 'En mora').length,
        activeLoansCount: assignedLoans.filter((l) => l.status !== 'Pagado' && l.status !== 'Anulado').length,
        totalRemainingCapital: assignedLoans.reduce((acc, l) => acc + Number(l.remainingCapital || 0), 0),
        totalRemainingInterest: assignedLoans.reduce((acc, l) => acc + Number(l.remainingInterest || 0), 0),
        externalTicketsCount
      }
    }

    // Disponibilidad dinámica de opciones del menú según registros existentes
    const availability = {
      hasUsers: scope.profile === 1 || (scope.profile === 2 && usersList.length > 0),
      hasSavings: scope.profile === 1 || savingsList.length > 0,
      hasLoans: scope.profile === 1 || loansList.length > 0,
      hasRifa1: scope.profile === 1 || rifa1List.length > 0,
      hasRifa2: scope.profile === 1 || rifa2List.length > 0,
      hasPayments: scope.profile === 1 || receiptsList.length > 0
    }

    return {
      profile: scope.profile,
      ownPartnerId,
      mySavings,
      myLoans,
      myReceiptsCount,
      teamSummary,
      availability
    }
  }
}
