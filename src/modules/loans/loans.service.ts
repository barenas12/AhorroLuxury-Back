import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'
import {
  addDaysUTC,
  diffDaysUTC,
  formatDateOnly,
  formatOverdueDuration,
  getTodayUTC,
  parseDateOnlyUTC
} from '../../shared/utils/date.utils'

export interface CreateLoanDTO {
  partnerId: number
  initialCapital: number
  interestRate: number
  initialInterestAmount?: number | null
  deliveryMethod: 'efectivo' | 'transferencia'
  guarantee: 'Oro' | 'Prenda' | 'Sin Prenda' | 'Negocio' | 'Otro'
  deliveryDate: string
  termDays: number
  dueDate?: string | null
  installments?: number | null
  observations?: string
  registeredBy: number
}

export interface LoanPaymentDTO {
  registeredBy: number
  paymentDate: string
  observations?: string
  capitalEfectivo: number
  capitalTransferencia: number
  interesEfectivo: number
  interesTransferencia: number
  markInterestUpToDate?: boolean
}

export interface UpdateLoanInterestDTO {
  interestRate?: number
  targetRemainingInterest?: number
}

export class LoansService {
  private computeLoanMetrics(loanRow: any, referenceDateStr?: string) {
    const initialCapital = Number(loanRow.initialCapital || 0)
    const interestRate = Number(loanRow.interestRate || 0)
    const termDays = Math.max(1, Number(loanRow.termDays || 30))
    const paidCapital = Number(loanRow.paidCapital || 0)
    const paidInterest = Number(loanRow.paidInterest || 0)
    const settledInterestBase = Number(loanRow.settledInterestBase || 0)
    const interestAdjustment = Number(loanRow.interestAdjustment || 0)
    const condonedInterest = Number(loanRow.condonedInterest || 0)
    const remainingCapital = Math.max(0, initialCapital - paidCapital)

    // Interés del ciclo calculado sobre el capital inicial
    const interestPerCycle = Math.round(initialCapital * (interestRate / 100))

    const refDate = (referenceDateStr ? parseDateOnlyUTC(referenceDateStr) : null) || getTodayUTC()
    const deliveryDate = parseDateOnlyUTC(loanRow.deliveryDate) || refDate
    const lastResetDate = parseDateOnlyUTC(loanRow.lastInterestUpToDateAt)

    let overdueTotalDays = 0
    let totalCycles = 1
    let totalExpectedInterest = 0

    if (lastResetDate) {
      const daysSinceReset = Math.max(0, diffDaysUTC(refDate, lastResetDate))
      const newCyclesAfterReset = Math.floor(daysSinceReset / 30)
      overdueTotalDays = loanRow.status === 'Pagado' ? 0 : (daysSinceReset >= 30 ? daysSinceReset : 0)
      totalExpectedInterest = Math.max(
        0,
        settledInterestBase + newCyclesAfterReset * interestPerCycle + interestAdjustment
      )
      totalCycles = newCyclesAfterReset
    } else {
      const dueDate = addDaysUTC(deliveryDate, termDays)
      const rawOverdueDays = Math.max(0, diffDaysUTC(refDate, dueDate))
      overdueTotalDays = loanRow.status === 'Pagado' ? 0 : rawOverdueDays

      // Al solicitar el préstamo ya se suma el interés inicial (por % o manual en pesos vía interestAdjustment).
      // Los intereses recurrentes por mora se suman siempre cada 30 días, nunca cada 15.
      const extraCycles = Math.floor(rawOverdueDays / 30)

      totalCycles = 1 + extraCycles
      totalExpectedInterest = Math.max(0, totalCycles * interestPerCycle + interestAdjustment)
    }

    const remainingInterest =
      loanRow.status === 'Pagado'
        ? Math.max(0, totalExpectedInterest - paidInterest - condonedInterest)
        : Math.max(0, totalExpectedInterest - paidInterest - condonedInterest)

    const overdueInfo = formatOverdueDuration(overdueTotalDays)

    return {
      ...loanRow,
      initialCapital,
      interestRate,
      termDays,
      installments: Number(loanRow.installments || 1),
      deliveryDate: formatDateOnly(loanRow.deliveryDate) || '',
      dueDate: formatDateOnly(loanRow.dueDate),
      lastInterestUpToDateAt: formatDateOnly(loanRow.lastInterestUpToDateAt),
      paidCapital,
      paidInterest,
      remainingCapital,
      interestPerCycle,
      totalCycles,
      settledInterestBase,
      interestAdjustment,
      condonedInterest,
      totalExpectedInterest,
      remainingInterest,
      overdueTotalDays: overdueInfo.overdueTotalDays,
      overdueMonths: overdueInfo.overdueMonths,
      overdueDays: overdueInfo.overdueDays,
      overdueLabel: overdueInfo.overdueLabel
    }
  }

  async getAllLoans(): Promise<any[]> {
    const query = `
      SELECT 
        l.\`id\`, l.\`partnerId\`, l.\`initialCapital\`, l.\`interestRate\`,
        l.\`settledInterestBase\`, l.\`interestAdjustment\`, l.\`condonedInterest\`,
        l.\`deliveryMethod\`, l.\`guarantee\`,
        DATE_FORMAT(l.\`deliveryDate\`, '%Y-%m-%d') AS \`deliveryDate\`,
        l.\`termDays\`,
        DATE_FORMAT(l.\`lastInterestUpToDateAt\`, '%Y-%m-%d') AS \`lastInterestUpToDateAt\`,
        DATE_FORMAT(l.\`dueDate\`, '%Y-%m-%d') AS \`dueDate\`,
        l.\`installments\`, l.\`status\`, l.\`observations\`,
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
    return rows.map((row) => this.computeLoanMetrics(row))
  }

  async getLoanById(loanId: number): Promise<any> {
    const query = `
      SELECT 
        l.\`id\`, l.\`partnerId\`, l.\`initialCapital\`, l.\`interestRate\`,
        l.\`settledInterestBase\`, l.\`interestAdjustment\`, l.\`condonedInterest\`,
        l.\`deliveryMethod\`, l.\`guarantee\`,
        DATE_FORMAT(l.\`deliveryDate\`, '%Y-%m-%d') AS \`deliveryDate\`,
        l.\`termDays\`,
        DATE_FORMAT(l.\`lastInterestUpToDateAt\`, '%Y-%m-%d') AS \`lastInterestUpToDateAt\`,
        DATE_FORMAT(l.\`dueDate\`, '%Y-%m-%d') AS \`dueDate\`,
        l.\`installments\`, l.\`status\`, l.\`observations\`,
        CONCAT_WS(' ', p.\`name\`, p.\`lastName\`) AS \`partnerName\`,
        p.\`documentId\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`,
        COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Capital Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidCapital\`,
        COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Interés Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidInterest\`
      FROM \`loans\` l
      JOIN \`partners\` p ON l.\`partnerId\` = p.\`id\`
      JOIN \`users\` u ON l.\`registeredBy\` = u.\`id\`
      LEFT JOIN \`payments\` pay ON l.\`id\` = pay.\`loanId\`
      WHERE l.\`id\` = ?
      GROUP BY l.\`id\`
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query, [loanId])
    if (rows.length === 0) throw new Error('Préstamo no encontrado.')
    return this.computeLoanMetrics(rows[0])
  }

  async getLoanReceipts(loanId: number): Promise<any[]> {
    const [receipts] = await dbPool.execute<RowDataPacket[]>(
      `
        SELECT
          r.\`id\`,
          r.\`loanId\`,
          r.\`totalAmount\`,
          DATE_FORMAT(r.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
          DATE_FORMAT(r.\`createdAt\`, '%Y-%m-%d %H:%i:%s') AS \`createdAt\`,
          r.\`observations\`,
          CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`
        FROM \`payment_receipts\` r
        JOIN \`users\` u ON r.\`registeredBy\` = u.\`id\`
        WHERE r.\`loanId\` = ?
        ORDER BY r.\`id\` DESC
      `,
      [loanId]
    )

    const [items] = await dbPool.execute<RowDataPacket[]>(
      `
        SELECT
          \`id\`, \`receiptId\`, \`amount\`, \`concept\`, \`paymentMethod\`,
          DATE_FORMAT(\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`, \`observations\`
        FROM \`payments\`
        WHERE \`loanId\` = ? AND \`receiptId\` IS NOT NULL
        ORDER BY \`id\` ASC
      `,
      [loanId]
    )

    const itemsByReceipt = new Map<number, any[]>()
    for (const it of items) {
      const rid = Number(it.receiptId)
      if (!itemsByReceipt.has(rid)) itemsByReceipt.set(rid, [])
      itemsByReceipt.get(rid)!.push(it)
    }

    return receipts.map((r) => {
      const rItems = itemsByReceipt.get(Number(r.id)) || []
      const capitalPayment = rItems
        .filter((it) => it.concept === 'Abono Capital Préstamo')
        .reduce((acc, it) => acc + Number(it.amount || 0), 0)
      const interestPayment = rItems
        .filter((it) => it.concept === 'Abono Interés Préstamo')
        .reduce((acc, it) => acc + Number(it.amount || 0), 0)
      return {
        id: Number(r.id),
        loanId: Number(r.loanId),
        totalAmount: Number(r.totalAmount || 0),
        capitalPayment,
        interestPayment,
        paymentDate: r.paymentDate,
        createdAt: r.createdAt,
        observations: r.observations || '',
        registeredByName: r.registeredByName,
        items: rItems
      }
    })
  }

  async createLoan(data: CreateLoanDTO): Promise<number> {
    const standardFirstCycle = Math.round(Number(data.initialCapital || 0) * (Number(data.interestRate || 0) / 100))
    const hasManualInitial =
      data.initialInterestAmount !== undefined &&
      data.initialInterestAmount !== null &&
      !isNaN(Number(data.initialInterestAmount))
    const interestAdjustment = hasManualInitial
      ? Math.max(0, Number(data.initialInterestAmount)) - standardFirstCycle
      : 0

    const query = `
      INSERT INTO \`loans\` (
        \`partnerId\`, \`initialCapital\`, \`interestRate\`, \`interestAdjustment\`, \`deliveryMethod\`, 
        \`guarantee\`, \`deliveryDate\`, \`termDays\`, \`dueDate\`, \`installments\`, 
        \`observations\`, \`registeredBy\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const [result] = await dbPool.execute<ResultSetHeader>(query, [
      data.partnerId,
      data.initialCapital,
      data.interestRate,
      interestAdjustment,
      data.deliveryMethod,
      data.guarantee,
      data.deliveryDate,
      data.termDays,
      data.dueDate || null,
      data.installments ? Number(data.installments) : 1,
      data.observations || '',
      data.registeredBy
    ])
    return result.insertId
  }

  async updateLoanInterest(loanId: number, data: UpdateLoanInterestDTO): Promise<any> {
    const current = await this.getLoanById(loanId)

    let nextRate = current.interestRate
    if (data.interestRate !== undefined && !isNaN(Number(data.interestRate))) {
      if (Number(data.interestRate) < 0) throw new Error('La tasa de interés no puede ser negativa.')
      nextRate = Number(data.interestRate)
    }

    // Recomputar métricas base con la nueva tasa y ajuste = 0 para calcular el delta si enviaron targetRemainingInterest
    let nextAdjustment = current.interestAdjustment
    if (data.targetRemainingInterest !== undefined && !isNaN(Number(data.targetRemainingInterest))) {
      const target = Math.max(0, Number(data.targetRemainingInterest))
      const baseWithZeroAdj = this.computeLoanMetrics({
        ...current,
        interestRate: nextRate,
        interestAdjustment: 0
      })
      const rawRemainingWithoutAdj =
        baseWithZeroAdj.totalExpectedInterest - baseWithZeroAdj.paidInterest - baseWithZeroAdj.condonedInterest
      nextAdjustment = target - rawRemainingWithoutAdj
    }

    await dbPool.execute(
      `UPDATE \`loans\` SET \`interestRate\` = ?, \`interestAdjustment\` = ? WHERE \`id\` = ?`,
      [nextRate, nextAdjustment, loanId]
    )

    return this.getLoanById(loanId)
  }

  async registerMixedPayment(
    loanId: number,
    data: LoanPaymentDTO
  ): Promise<{ receiptId: number | null; paymentIds: number[]; condonedNow: number }> {
    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()

      const [loanRows]: any = await connection.execute(
        `
          SELECT
            l.\`id\`, l.\`partnerId\`, l.\`initialCapital\`, l.\`interestRate\`,
            l.\`settledInterestBase\`, l.\`interestAdjustment\`, l.\`condonedInterest\`,
            DATE_FORMAT(l.\`deliveryDate\`, '%Y-%m-%d') AS \`deliveryDate\`,
            l.\`termDays\`,
            DATE_FORMAT(l.\`lastInterestUpToDateAt\`, '%Y-%m-%d') AS \`lastInterestUpToDateAt\`,
            l.\`status\`,
            COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Capital Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidCapital\`,
            COALESCE(SUM(CASE WHEN pay.\`concept\` = 'Abono Interés Préstamo' THEN pay.\`amount\` ELSE 0 END), 0) AS \`paidInterest\`
          FROM \`loans\` l
          LEFT JOIN \`payments\` pay ON l.\`id\` = pay.\`loanId\`
          WHERE l.\`id\` = ?
          GROUP BY l.\`id\`
        `,
        [loanId]
      )
      if (loanRows.length === 0) throw new Error('Préstamo no encontrado.')
      const loanRow = loanRows[0]
      const partnerId = Number(loanRow.partnerId)
      const paymentDate = formatDateOnly(data.paymentDate) || new Date().toISOString().substring(0, 10)
      const metricsBefore = this.computeLoanMetrics(loanRow, paymentDate)

      const insertPaymentQuery = `
        INSERT INTO \`payments\` (
          \`partnerId\`, \`registeredBy\`, \`amount\`, \`concept\`, 
          \`paymentMethod\`, \`paymentDate\`, \`observations\`, \`loanId\`,
          \`hasFine\`, \`fineAmount\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `

      const paymentIds: number[] = []
      let totalPaidNow = 0
      const paymentsToInsert = [
        [Number(data.capitalEfectivo || 0), 'Abono Capital Préstamo', 'efectivo'],
        [Number(data.capitalTransferencia || 0), 'Abono Capital Préstamo', 'transferencia'],
        [Number(data.interesEfectivo || 0), 'Abono Interés Préstamo', 'efectivo'],
        [Number(data.interesTransferencia || 0), 'Abono Interés Préstamo', 'transferencia']
      ] as const

      for (const [amount, concept, paymentMethod] of paymentsToInsert) {
        if (amount <= 0) continue
        const [result] = await connection.execute<ResultSetHeader>(insertPaymentQuery, [
          partnerId,
          Number(data.registeredBy),
          amount,
          concept,
          paymentMethod,
          paymentDate,
          data.observations || '',
          loanId
        ])
        paymentIds.push(result.insertId)
        totalPaidNow += amount
      }

      // Crear registro único consolidado en payment_receipts si hubo dinero registrado
      let receiptId: number | null = null
      if (paymentIds.length > 0) {
        const [receiptResult] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO \`payment_receipts\` (
              \`receiptType\`, \`partnerId\`, \`externalTicketId\`, \`loanId\`,
              \`paymentIds\`, \`totalAmount\`, \`paymentDate\`, \`registeredBy\`, \`observations\`
            ) VALUES ('loan_payment', ?, NULL, ?, ?, ?, ?, ?, ?)
          `,
          [
            partnerId,
            loanId,
            JSON.stringify(paymentIds),
            totalPaidNow,
            paymentDate,
            Number(data.registeredBy),
            data.observations ? data.observations.trim() : null
          ]
        )
        receiptId = receiptResult.insertId

        const placeholders = paymentIds.map(() => '?').join(',')
        await connection.execute(
          `UPDATE \`payments\` SET \`receiptId\` = ? WHERE \`id\` IN (${placeholders})`,
          [receiptId, ...paymentIds]
        )
      }

      // Si se activó "Intereses al día": condonar solo los intereses pendientes hasta la fecha del pago
      let condonedNow = 0
      if (data.markInterestUpToDate) {
        const interestPaidNow = Number(data.interesEfectivo || 0) + Number(data.interesTransferencia || 0)
        condonedNow = Math.max(0, metricsBefore.remainingInterest - interestPaidNow)
        const newPaidInterest = Number(loanRow.paidInterest || 0) + interestPaidNow
        const newCondonedInterest = Number(loanRow.condonedInterest || 0) + condonedNow
        const newSettledBase = newPaidInterest + newCondonedInterest

        await connection.execute(
          `
            UPDATE \`loans\`
            SET \`condonedInterest\` = ?,
                \`settledInterestBase\` = ?,
                \`interestAdjustment\` = 0,
                \`lastInterestUpToDateAt\` = ?
            WHERE \`id\` = ?
          `,
          [newCondonedInterest, newSettledBase, paymentDate, loanId]
        )
      }

      // Verificar si se liquidó el capital completo
      const [sumRows]: any = await connection.execute(
        `SELECT COALESCE(SUM(\`amount\`), 0) AS totalCapitalPaid FROM \`payments\` WHERE \`loanId\` = ? AND \`concept\` = 'Abono Capital Préstamo'`,
        [loanId]
      )
      const totalCapitalPaid = Number(sumRows[0].totalCapitalPaid || 0)
      if (totalCapitalPaid >= Number(loanRow.initialCapital)) {
        await connection.execute(`UPDATE \`loans\` SET \`status\` = 'Pagado' WHERE \`id\` = ?`, [loanId])
      }

      await connection.commit()
      return { receiptId, paymentIds, condonedNow }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
