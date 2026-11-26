import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'
import {
  addDaysUTC,
  calculateQuotaByFrequency,
  diffDaysUTC,
  formatDateOnly,
  formatOverdueDuration,
  getTodayUTC,
  parseDateOnlyUTC
} from '../../shared/utils/date.utils'
import { ViewerScope } from '../../shared/utils/scope.utils'

export interface TicketStatusItem {
  number: string
  raffle: 'Rifa 1' | 'Rifa 2'
  raffleType: 1 | 2
  isPaid: boolean
  status: 'Al día' | 'En mora'
}

export interface PartnerSavingsStatus {
  id: number
  documentId: string
  fullName: string
  cellphone: string
  coordinatorName: string
  frequency: number
  savingsValue: number
  quotaValue: number
  savingsStartDate: string | null
  savingsUpToDateAt: string | null
  totalSavedCurrentPeriod: number
  overdueAmount: number
  savingsStatus: 'Al día' | 'En mora'
  overdueTotalDays: number
  overdueMonths: number
  overdueDays: number
  overdueLabel: string
  ticketsRifa1: TicketStatusItem[]
  ticketsRifa2: TicketStatusItem[]
  rifa1Status: 'Al día' | 'En mora' | 'Sin boletas'
  rifa2Status: 'Al día' | 'En mora' | 'Sin boletas'
  ticketsStatus: TicketStatusItem[]
  generalTicketStatus: 'Al día' | 'En mora'
}

export class SavingsService {
  async getSavingsDashboard(scope?: ViewerScope): Promise<PartnerSavingsStatus[]> {
    // 1. Obtener socios activos filtrados según el alcance del perfil
    let partnersQuery = `
      SELECT 
        p.\`id\`,
        p.\`documentId\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`fullName\`,
        p.\`cellphone\`,
        p.\`coordinator\`,
        p.\`frequency\`,
        p.\`savingsValue\`,
        DATE_FORMAT(p.\`savingsStartDate\`, '%Y-%m-%d') AS \`savingsStartDate\`,
        DATE_FORMAT(p.\`savingsUpToDateAt\`, '%Y-%m-%d') AS \`savingsUpToDateAt\`,
        p.\`statusValue\`,
        p.\`ticket\`,
        p.\`ticket2\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`
      FROM \`partners\` p
      LEFT JOIN \`users\` coord ON p.\`coordinator\` = coord.\`id\`
      WHERE COALESCE(p.\`status\`, 1) = 1
    `
    const params: any[] = []

    if (scope && scope.profile === 3) {
      if (!scope.ownPartnerId) return []
      partnersQuery += ` AND p.\`id\` = ? `
      params.push(scope.ownPartnerId)
    } else if (scope && scope.profile === 2) {
      const clauses: string[] = []
      if (scope.ownPartnerId) {
        clauses.push(`p.\`id\` = ?`)
        params.push(scope.ownPartnerId)
      }
      if (scope.userId) {
        clauses.push(`p.\`coordinator\` = ?`)
        params.push(scope.userId)
      }
      if (clauses.length === 0) return []
      partnersQuery += ` AND (${clauses.join(' OR ')}) `
    }

    const [partners] = await dbPool.execute<RowDataPacket[]>(partnersQuery, params)

    if (partners.length === 0) {
      return []
    }

    // 2. Obtener únicamente pagos pertenecientes a los socios dentro del alcance
    const partnerIds = partners.map((p) => Number(p.id))
    const idPlaceholders = partnerIds.map(() => '?').join(',')
    const paymentsQuery = `
      SELECT 
        \`partnerId\`,
        \`amount\`,
        \`concept\`,
        \`ticketNumber\`,
        \`raffleType\`,
        DATE_FORMAT(\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`
      FROM \`payments\`
      WHERE \`partnerId\` IN (${idPlaceholders})
    `
    const [payments] = await dbPool.execute<RowDataPacket[]>(paymentsQuery, partnerIds)

    const parseTicketsArray = (raw: string | undefined): string[] => {
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim().padStart(2, '0')).filter(Boolean)
        return []
      } catch {
        return raw.split(',').map((t) => t.trim().padStart(2, '0')).filter(Boolean)
      }
    }

    const today = getTodayUTC()

    const results: PartnerSavingsStatus[] = partners.map((p) => {
      const partnerPayments = payments.filter((pay) => Number(pay.partnerId) === Number(p.id))
      const freq = Number(p.frequency) || 30
      const totalMonthlySavings = Number(p.savingsValue) || 0
      const quotaValue = calculateQuotaByFrequency(totalMonthlySavings, freq)

      // Solo sumar el valor neto del abono (amount). La multa NO se suma al ahorro
      const savingsPayments = partnerPayments.filter((pay) => pay.concept === 'Abono Ahorro')
      const totalSaved = savingsPayments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0)

      const startDateStr = formatDateOnly(p.savingsStartDate)
      const upToDateStr = formatDateOnly(p.savingsUpToDateAt)

      let overdueAmount = 0
      let overdueTotalDays = 0
      let savingsStatus: 'Al día' | 'En mora' = 'Al día'

      if (upToDateStr) {
        const baselineDate = parseDateOnlyUTC(upToDateStr)!
        const daysElapsed = diffDaysUTC(today, baselineDate)

        if (daysElapsed >= freq) {
          const savedAfterBaseline = savingsPayments
            .filter((pay) => {
              const pd = formatDateOnly(pay.paymentDate)
              return pd !== null && pd > upToDateStr
            })
            .reduce((acc, pay) => acc + Number(pay.amount || 0), 0)

          const periodsDue = Math.floor(daysElapsed / freq)
          const expectedSinceBaseline = periodsDue * quotaValue
          overdueAmount = Math.max(0, expectedSinceBaseline - savedAfterBaseline)

          if (overdueAmount > 0) {
            savingsStatus = 'En mora'
            const coveredPeriods = quotaValue > 0 ? Math.floor(savedAfterBaseline / quotaValue) : 0
            const paidThroughDate = addDaysUTC(baselineDate, coveredPeriods * freq)
            overdueTotalDays = Math.max(0, diffDaysUTC(today, paidThroughDate))
          }
        }
      } else {
        // Sin fecha de "Al día": usar savingsStartDate o la fecha del primer abono de ahorro
        let baselineDate = parseDateOnlyUTC(startDateStr)
        if (!baselineDate && savingsPayments.length > 0) {
          const earliest = [...savingsPayments]
            .map((pay) => parseDateOnlyUTC(pay.paymentDate))
            .filter((d): d is Date => d !== null)
            .sort((a, b) => a.getTime() - b.getTime())[0]
          baselineDate = earliest || null
        }

        if (baselineDate) {
          const daysElapsed = diffDaysUTC(today, baselineDate)
          if (daysElapsed >= freq) {
            const periodsDue = Math.floor(daysElapsed / freq)
            const expectedTotal = periodsDue * quotaValue
            overdueAmount = Math.max(0, expectedTotal - totalSaved)

            if (overdueAmount > 0) {
              savingsStatus = 'En mora'
              const coveredPeriods = quotaValue > 0 ? Math.floor(totalSaved / quotaValue) : 0
              const paidThroughDate = addDaysUTC(baselineDate, coveredPeriods * freq)
              overdueTotalDays = Math.max(0, diffDaysUTC(today, paidThroughDate))
            }
          }
        }
      }

      const overdueInfo = formatOverdueDuration(overdueTotalDays)

      // Boletas pagadas separadas por Rifa 1 y Rifa 2
      const ticketPayments = partnerPayments.filter(
        (pay) => pay.concept === 'Pago Boleta' && pay.ticketNumber
      )

      const isTicketPaid = (ticketNum: string, raffleType: 1 | 2): boolean => {
        return ticketPayments.some(
          (pay) =>
            String(pay.ticketNumber).trim().padStart(2, '0') === ticketNum &&
            (Number(pay.raffleType) === raffleType || pay.raffleType === null)
        )
      }

      const tickets1 = parseTicketsArray(p.ticket)
      const tickets2 = parseTicketsArray(p.ticket2)

      const ticketsRifa1: TicketStatusItem[] = tickets1.map((t) => {
        const isPaid = isTicketPaid(t, 1)
        return {
          number: t,
          raffle: 'Rifa 1',
          raffleType: 1,
          isPaid,
          status: isPaid ? 'Al día' : 'En mora'
        }
      })

      const ticketsRifa2: TicketStatusItem[] = tickets2.map((t) => {
        const isPaid = isTicketPaid(t, 2)
        return {
          number: t,
          raffle: 'Rifa 2',
          raffleType: 2,
          isPaid,
          status: isPaid ? 'Al día' : 'En mora'
        }
      })

      const rifa1Status: 'Al día' | 'En mora' | 'Sin boletas' =
        ticketsRifa1.length === 0
          ? 'Sin boletas'
          : ticketsRifa1.some((t) => !t.isPaid)
            ? 'En mora'
            : 'Al día'

      const rifa2Status: 'Al día' | 'En mora' | 'Sin boletas' =
        ticketsRifa2.length === 0
          ? 'Sin boletas'
          : ticketsRifa2.some((t) => !t.isPaid)
            ? 'En mora'
            : 'Al día'

      const ticketsStatus: TicketStatusItem[] = [...ticketsRifa1, ...ticketsRifa2]
      const hasUnpaidTickets = ticketsStatus.some((t) => !t.isPaid)
      const generalTicketStatus: 'Al día' | 'En mora' =
        ticketsStatus.length > 0 && hasUnpaidTickets ? 'En mora' : 'Al día'

      return {
        id: Number(p.id),
        documentId: p.documentId,
        fullName: p.fullName,
        cellphone: String(p.cellphone || ''),
        coordinatorName: p.coordinatorName,
        frequency: freq,
        savingsValue: totalMonthlySavings,
        quotaValue,
        savingsStartDate: startDateStr,
        savingsUpToDateAt: upToDateStr,
        totalSavedCurrentPeriod: totalSaved,
        overdueAmount,
        savingsStatus,
        overdueTotalDays: overdueInfo.overdueTotalDays,
        overdueMonths: overdueInfo.overdueMonths,
        overdueDays: overdueInfo.overdueDays,
        overdueLabel: overdueInfo.overdueLabel,
        ticketsRifa1,
        ticketsRifa2,
        rifa1Status,
        rifa2Status,
        ticketsStatus,
        generalTicketStatus
      }
    })

    results.sort((a, b) => b.id - a.id)

    return results
  }
}
