import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface PartnerSavingsStatus {
  id: number
  documentId: string
  fullName: string
  cellphone: number
  coordinatorName: string
  frequency: number
  savingsValue: number
  totalSavedCurrentPeriod: number
  overdueAmount: number // 👈 Valor exacto en mora
  savingsStatus: 'Al día' | 'En mora'
  nextDueDate: string
  daysRemaining: number
  ticketsStatus: {
    number: string
    raffle: string
    isPaid: boolean
    status: 'Al día' | 'En mora'
  }[]
  generalTicketStatus: 'Al día' | 'En mora'
}

export class SavingsService {
  async getSavingsDashboard(): Promise<PartnerSavingsStatus[]> {
    // 1. Obtener socios activos
    const partnersQuery = `
      SELECT 
        p.\`id\`,
        p.\`documentId\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`cellphone\`,
        p.\`frequency\`,
        p.\`savingsValue\`,
        p.\`ticket\`,
        p.\`ticket2\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`
      FROM \`partners\` p
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
      WHERE p.\`status\` = 1
    `
    const [partners] = await dbPool.execute<RowDataPacket[]>(partnersQuery)

    // 2. Obtener pagos
    const paymentsQuery = `
      SELECT 
        \`partnerId\`,
        \`amount\`,
        \`concept\`,
        \`ticketNumber\`,
        \`paymentDate\`
      FROM \`payments\`
    `
    const [payments] = await dbPool.execute<RowDataPacket[]>(paymentsQuery)

    const parseTicketsArray = (raw: string | undefined): string[] => {
      if (!raw) return []
      try {
        return JSON.parse(raw)
      } catch {
        return raw.split(',').map((t) => t.trim()).filter(Boolean)
      }
    }

    const today = new Date()

    const results: PartnerSavingsStatus[] = partners.map((p) => {
      const partnerPayments = payments.filter((pay) => pay.partnerId === p.id)
      const freq = Number(p.frequency) || 15
      const totalMonthlySavings = Number(p.savingsValue) || 0

      // Cuota teórica según frecuencia
      let expectedQuota = totalMonthlySavings
      if (freq === 15) expectedQuota = Math.round(totalMonthlySavings / 2)
      else if (freq === 8) expectedQuota = Math.round(totalMonthlySavings / 4)

      // 1. Solo sumar el valor neto del abono (amount). La multa NO se suma al ahorro
      const savingsPayments = partnerPayments.filter((pay) => pay.concept === 'Abono Ahorro')
      const totalSaved = savingsPayments.reduce((acc, pay) => acc + Number(pay.amount), 0)

      // Cálculo de fecha de vencimiento
      let lastDate = new Date()
      if (savingsPayments.length > 0) {
        const sorted = [...savingsPayments].sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )
        const first = sorted[0]
        if (first) {
          lastDate = new Date(first.paymentDate)
        }
      }

      const nextDue = new Date(lastDate)
      nextDue.setDate(nextDue.getDate() + freq)

      const diffTime = nextDue.getTime() - today.getTime()
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // 2. Cálculo del Valor en Mora
      let overdueAmount = 0
      let savingsStatus: 'Al día' | 'En mora' = 'Al día'

      if (totalSaved < expectedQuota || daysRemaining < 0) {
        savingsStatus = 'En mora'
        overdueAmount = Math.max(0, expectedQuota - totalSaved)
      } else {
        savingsStatus = 'Al día'
        overdueAmount = 0
      }

      // Boletas pagadas
      const paidTicketNumbers = partnerPayments
        .filter((pay) => pay.concept === 'Pago Boleta' && pay.ticketNumber)
        .map((pay) => pay.ticketNumber)

      const tickets1 = parseTicketsArray(p.ticket)
      const tickets2 = parseTicketsArray(p.ticket2)

      const ticketsStatus: any[] = []

      tickets1.forEach((t) => {
        const isPaid = paidTicketNumbers.includes(t)
        ticketsStatus.push({
          number: t,
          raffle: 'Rifa 1',
          isPaid,
          status: isPaid ? 'Al día' : 'En mora'
        })
      })

      tickets2.forEach((t) => {
        const isPaid = paidTicketNumbers.includes(t)
        ticketsStatus.push({
          number: t,
          raffle: 'Rifa 2',
          isPaid,
          status: isPaid ? 'Al día' : 'En mora'
        })
      })

      const hasUnpaidTickets = ticketsStatus.some((t) => !t.isPaid)
      const generalTicketStatus: 'Al día' | 'En mora' =
        ticketsStatus.length > 0 && hasUnpaidTickets ? 'En mora' : 'Al día'

      return {
        id: p.id,
        documentId: p.documentId,
        fullName: p.fullName,
        cellphone: p.cellphone,
        coordinatorName: p.coordinatorName,
        frequency: freq,
        savingsValue: totalMonthlySavings,
        totalSavedCurrentPeriod: totalSaved,
        overdueAmount, // 👈 Valor en mora calculado
        savingsStatus,
        nextDueDate: nextDue.toISOString().substring(0, 10),
        daysRemaining,
        ticketsStatus,
        generalTicketStatus
      }
    })

    // Ordenar de menor a mayor por días restantes (los más urgentes/vencidos arriba)
    results.sort((a, b) => a.daysRemaining - b.daysRemaining)

    return results
  }
}