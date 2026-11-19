import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'
import { calculateQuotaByFrequency, formatDateOnly } from '../../shared/utils/date.utils'

export interface PaymentRowItemDTO {
  concept: string
  ticketNumber?: string | null
  raffleType?: 1 | 2 | null
  externalTicketId?: number | null
  amount: number
  paymentMethod: 'efectivo' | 'transferencia'
  paymentDate: string
  observations?: string
  hasFine: boolean
  fineAmount?: number
}

export interface CreateMultiplePaymentsDTO {
  partnerId?: number | null
  externalTicketId?: number | null
  registeredBy: number
  markSavingsUpToDate?: boolean
  items: PaymentRowItemDTO[]
}

export class PaymentsService {
  private parseTicketsSafe(raw: string | string[] | null | undefined): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean)
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean)
      return []
    } catch {
      return String(raw).split(',').map((t) => t.trim()).filter(Boolean)
    }
  }

  // 1. Obtener todos los pagos individuales (retrocompatible)
  async getAllPayments(): Promise<RowDataPacket[]> {
    const query = `
      SELECT 
        pay.\`id\`,
        pay.\`receiptId\`,
        pay.\`partnerId\`,
        pay.\`externalTicketId\`,
        pay.\`loanId\`,
        COALESCE(NULLIF(p.\`documentId\`, ''), CONCAT('Tel: ', ext.\`cellphone\`)) AS \`partnerDocument\`,
        COALESCE(NULLIF(CONCAT_WS(' ', p.\`name\`, p.\`lastName\`), ''), ext.\`fullName\`, 'Desconocido') AS \`partnerName\`,
        pay.\`registeredBy\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`,
        pay.\`amount\`,
        pay.\`concept\`,
        pay.\`ticketNumber\`,
        pay.\`raffleType\`,
        pay.\`paymentMethod\`,
        pay.\`hasFine\`,
        pay.\`fineAmount\`,
        (pay.\`amount\` + pay.\`fineAmount\`) AS \`totalPaid\`,
        DATE_FORMAT(pay.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
        DATE_FORMAT(pay.\`createdAt\`, '%Y-%m-%d %H:%i:%s') AS \`createdAt\`,
        pay.\`observations\`
      FROM \`payments\` pay
      LEFT JOIN \`partners\` p ON pay.\`partnerId\` = p.\`id\`
      LEFT JOIN \`raffle_external_tickets\` ext ON pay.\`externalTicketId\` = ext.\`id\`
      INNER JOIN \`users\` u ON pay.\`registeredBy\` = u.\`id\`
      ORDER BY pay.\`id\` DESC
    `
    const [rows] = await dbPool.execute<RowDataPacket[]>(query)
    return rows
  }

  // 1B. Obtener listado CONSOLIDADO por recibo único (1 fila por payment_receipts)
  async getConsolidatedReceipts(): Promise<any[]> {
    const receiptsQuery = `
      SELECT
        r.\`id\`,
        r.\`receiptType\`,
        r.\`partnerId\`,
        r.\`externalTicketId\`,
        r.\`loanId\`,
        r.\`paymentIds\`,
        r.\`totalAmount\`,
        DATE_FORMAT(r.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
        r.\`registeredBy\`,
        r.\`observations\`,
        DATE_FORMAT(r.\`createdAt\`, '%Y-%m-%d %H:%i:%s') AS \`createdAt\`,
        COALESCE(NULLIF(p.\`documentId\`, ''), ext.\`cellphone\`, '') AS \`partnerDocument\`,
        COALESCE(NULLIF(CONCAT_WS(' ', p.\`name\`, p.\`lastName\`), ''), ext.\`fullName\`, 'Desconocido') AS \`partnerName\`,
        CASE WHEN r.\`partnerId\` IS NULL AND r.\`externalTicketId\` IS NOT NULL THEN 'external' ELSE 'partner' END AS \`payerType\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`registeredByName\`
      FROM \`payment_receipts\` r
      LEFT JOIN \`partners\` p ON r.\`partnerId\` = p.\`id\`
      LEFT JOIN \`raffle_external_tickets\` ext ON r.\`externalTicketId\` = ext.\`id\`
      INNER JOIN \`users\` u ON r.\`registeredBy\` = u.\`id\`
      ORDER BY r.\`id\` DESC
    `
    const [receipts] = await dbPool.execute<RowDataPacket[]>(receiptsQuery)

    const itemsQuery = `
      SELECT
        pay.\`id\`,
        pay.\`receiptId\`,
        pay.\`partnerId\`,
        pay.\`externalTicketId\`,
        pay.\`loanId\`,
        pay.\`amount\`,
        pay.\`concept\`,
        pay.\`ticketNumber\`,
        pay.\`raffleType\`,
        pay.\`paymentMethod\`,
        pay.\`hasFine\`,
        pay.\`fineAmount\`,
        (pay.\`amount\` + pay.\`fineAmount\`) AS \`totalPaid\`,
        DATE_FORMAT(pay.\`paymentDate\`, '%Y-%m-%d') AS \`paymentDate\`,
        pay.\`observations\`
      FROM \`payments\` pay
      WHERE pay.\`receiptId\` IS NOT NULL
      ORDER BY pay.\`id\` ASC
    `
    const [allItems] = await dbPool.execute<RowDataPacket[]>(itemsQuery)

    const itemsByReceipt = new Map<number, any[]>()
    for (const item of allItems) {
      const rid = Number(item.receiptId)
      if (!itemsByReceipt.has(rid)) itemsByReceipt.set(rid, [])
      itemsByReceipt.get(rid)!.push({
        id: item.id,
        concept: item.concept,
        ticketNumber: item.ticketNumber,
        raffleType: item.raffleType ? Number(item.raffleType) : null,
        externalTicketId: item.externalTicketId ? Number(item.externalTicketId) : null,
        amount: Number(item.amount || 0),
        hasFine: Number(item.hasFine || 0),
        fineAmount: Number(item.fineAmount || 0),
        totalPaid: Number(item.totalPaid || 0),
        paymentMethod: item.paymentMethod,
        paymentDate: item.paymentDate,
        observations: item.observations || ''
      })
    }

    return receipts.map((r) => {
      const items = itemsByReceipt.get(Number(r.id)) || []
      const totalPureAmount = items.reduce((acc, it) => acc + Number(it.amount || 0), 0)
      const totalFines = items.reduce((acc, it) => acc + Number(it.fineAmount || 0), 0)
      const paymentMethods = Array.from(new Set(items.map((it) => it.paymentMethod)))
      const conceptsSummary = items
        .map((it) => {
          if (it.concept === 'Pago Boleta' && it.ticketNumber) {
            const rLabel = it.raffleType ? ` R${it.raffleType}` : ''
            return `Boleta #${it.ticketNumber}${rLabel}`
          }
          if (Number(it.amount) === 0 && Number(it.fineAmount) > 0) {
            return `${it.concept} (Solo Multa)`
          }
          return it.concept
        })
        .join(', ')

      return {
        id: Number(r.id),
        receiptType: r.receiptType,
        partnerId: r.partnerId ? Number(r.partnerId) : null,
        externalTicketId: r.externalTicketId ? Number(r.externalTicketId) : null,
        loanId: r.loanId ? Number(r.loanId) : null,
        payerType: r.payerType,
        partnerName: r.partnerName,
        partnerDocument: r.partnerDocument,
        registeredBy: Number(r.registeredBy),
        registeredByName: r.registeredByName,
        totalAmount: Number(r.totalAmount || 0),
        totalPureAmount,
        totalFines,
        paymentDate: r.paymentDate,
        createdAt: r.createdAt,
        observations: r.observations || '',
        paymentMethods,
        conceptsSummary,
        itemsCount: items.length,
        items
      }
    })
  }

  // 2. Traer socios activos (con frecuencia, cuota dividida y ambas rifas) + compradores externos de boletas
  async getActivePartners(onlyPartners = false): Promise<any[]> {
    const partnersQuery = `
      SELECT 
        \`id\`,
        \`documentId\`,
        CONCAT_WS(' ', \`name\`, \`lastName\`) AS \`fullName\`,
        \`savingsValue\`,
        \`frequency\`,
        DATE_FORMAT(\`savingsStartDate\`, '%Y-%m-%d') AS \`savingsStartDate\`,
        \`statusValue\`,
        \`ticket\`,
        \`ticket2\`
      FROM \`partners\`
      WHERE COALESCE(\`status\`, 1) = 1
      ORDER BY \`name\` ASC
    `
    const [partnerRows] = await dbPool.execute<RowDataPacket[]>(partnersQuery)

    const [paidTicketsRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT \`partnerId\`, \`externalTicketId\`, \`ticketNumber\`, \`raffleType\`
       FROM \`payments\`
       WHERE \`concept\` = 'Pago Boleta'`
    )

    const result: any[] = partnerRows.map((p) => {
      const freq = Number(p.frequency) || 30
      const monthly = Number(p.savingsValue) || 0
      const quotaValue = calculateQuotaByFrequency(monthly, freq)

      const t1 = this.parseTicketsSafe(p.ticket).map((num) => {
        const formatted = String(num).padStart(2, '0')
        const isPaid = paidTicketsRows.some(
          (pay) =>
            Number(pay.partnerId) === Number(p.id) &&
            String(pay.ticketNumber || '').padStart(2, '0') === formatted &&
            (Number(pay.raffleType) === 1 || pay.raffleType === null)
        )
        return {
          number: formatted,
          raffleType: 1 as const,
          raffleLabel: 'Rifa 1',
          isPaid,
          externalTicketId: null
        }
      })

      const t2 = this.parseTicketsSafe(p.ticket2).map((num) => {
        const formatted = String(num).padStart(2, '0')
        const isPaid = paidTicketsRows.some(
          (pay) =>
            Number(pay.partnerId) === Number(p.id) &&
            String(pay.ticketNumber || '').padStart(2, '0') === formatted &&
            (Number(pay.raffleType) === 2 || pay.raffleType === null)
        )
        return {
          number: formatted,
          raffleType: 2 as const,
          raffleLabel: 'Rifa 2',
          isPaid,
          externalTicketId: null
        }
      })

      return {
        key: `partner:${p.id}`,
        id: Number(p.id),
        partnerId: Number(p.id),
        externalTicketId: null,
        payerType: 'partner' as const,
        documentId: p.documentId,
        fullName: p.fullName,
        savingsValue: monthly,
        frequency: freq,
        quotaValue,
        savingsStartDate: p.savingsStartDate || null,
        statusValue: p.statusValue || 'Al día',
        ticket: p.ticket,
        ticket2: p.ticket2,
        tickets: [...t1, ...t2]
      }
    })

    if (onlyPartners) return result

    // Agregar personas externas que compraron boletas por afuera (agrupadas por nombre + celular)
    const [externalRows] = await dbPool.execute<RowDataPacket[]>(`
      SELECT
        e.\`id\`,
        e.\`raffleType\`,
        e.\`ticketNumber\`,
        e.\`fullName\`,
        e.\`cellphone\`,
        COALESCE(CONCAT_WS(' ', coord.\`name\`, coord.\`lastName\`), 'Sin asignar') AS \`coordinatorName\`
      FROM \`raffle_external_tickets\` e
      LEFT JOIN \`users\` coord ON e.\`coordinatorId\` = coord.\`id\`
      ORDER BY e.\`fullName\` ASC, e.\`raffleType\` ASC, e.\`ticketNumber\` ASC
    `)

    const externalGroups = new Map<string, any>()
    for (const ext of externalRows) {
      const groupKey = `${String(ext.fullName).trim().toLowerCase()}|${String(ext.cellphone).trim()}`
      const formatted = String(ext.ticketNumber).padStart(2, '0')
      const rType = Number(ext.raffleType) === 2 ? 2 : 1
      const isPaid = paidTicketsRows.some((pay) => Number(pay.externalTicketId) === Number(ext.id))

      if (!externalGroups.has(groupKey)) {
        externalGroups.set(groupKey, {
          key: `external:${ext.id}`,
          id: -Number(ext.id),
          partnerId: null,
          externalTicketId: Number(ext.id),
          payerType: 'external' as const,
          documentId: String(ext.cellphone || 'Externo'),
          cellphone: String(ext.cellphone || ''),
          coordinatorName: ext.coordinatorName,
          fullName: ext.fullName,
          savingsValue: 0,
          frequency: 0,
          quotaValue: 0,
          savingsStartDate: null,
          statusValue: 'Al día',
          ticket: '[]',
          ticket2: '[]',
          tickets: []
        })
      }

      externalGroups.get(groupKey).tickets.push({
        number: formatted,
        raffleType: rType,
        raffleLabel: rType === 2 ? 'Rifa 2' : 'Rifa 1',
        isPaid,
        externalTicketId: Number(ext.id)
      })
    }

    for (const extEntry of externalGroups.values()) {
      result.push(extEntry)
    }

    return result
  }

  // 3. Crear pagos + registro único en payment_receipts + soporte "Al día" y externos
  async createMultiplePayments(data: CreateMultiplePaymentsDTO): Promise<{ receiptId: number; paymentIds: number[] }> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Debe ingresar al menos un concepto de pago.')
    }

    const connection = await dbPool.getConnection()
    try {
      await connection.beginTransaction()
      const paymentIds: number[] = []
      let totalConsolidated = 0
      let primaryExternalTicketId: number | null = data.externalTicketId ? Number(data.externalTicketId) : null
      let latestPaymentDate: string = formatDateOnly(data.items[0]?.paymentDate) || new Date().toISOString().substring(0, 10)
      const obsList: string[] = []

      for (const item of data.items) {
        const hasFineFlag = item.hasFine ? 1 : 0
        const amountVal = Number(item.amount || 0)
        const fineValue = item.hasFine ? Number(item.fineAmount || 0) : 0
        const ticket = item.concept === 'Pago Boleta' ? (item.ticketNumber ? String(item.ticketNumber).padStart(2, '0') : null) : null
        const raffleType = item.concept === 'Pago Boleta' && item.raffleType ? Number(item.raffleType) : null
        const itemExternalTicketId = item.externalTicketId ? Number(item.externalTicketId) : (data.partnerId ? null : primaryExternalTicketId)

        if (!primaryExternalTicketId && itemExternalTicketId) {
          primaryExternalTicketId = itemExternalTicketId
        }

        const pDate = formatDateOnly(item.paymentDate) || latestPaymentDate
        if (pDate > latestPaymentDate) latestPaymentDate = pDate
        if (item.observations && item.observations.trim()) obsList.push(item.observations.trim())

        const query = `
          INSERT INTO \`payments\` (
            \`partnerId\`, \`externalTicketId\`, \`registeredBy\`, \`amount\`, \`concept\`,
            \`ticketNumber\`, \`raffleType\`, \`paymentMethod\`, \`hasFine\`, \`fineAmount\`,
            \`paymentDate\`, \`observations\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        const [result] = await connection.execute<ResultSetHeader>(query, [
          data.partnerId ? Number(data.partnerId) : null,
          itemExternalTicketId,
          Number(data.registeredBy),
          amountVal,
          item.concept.trim(),
          ticket,
          raffleType,
          item.paymentMethod,
          hasFineFlag,
          fineValue,
          pDate,
          item.observations ? item.observations.trim() : null
        ])

        paymentIds.push(result.insertId)
        totalConsolidated += amountVal + fineValue
      }

      // Crear el registro único consolidado en payment_receipts
      const receiptQuery = `
        INSERT INTO \`payment_receipts\` (
          \`receiptType\`, \`partnerId\`, \`externalTicketId\`, \`loanId\`,
          \`paymentIds\`, \`totalAmount\`, \`paymentDate\`, \`registeredBy\`, \`observations\`
        ) VALUES ('payment', ?, ?, NULL, ?, ?, ?, ?, ?)
      `
      const [receiptResult] = await connection.execute<ResultSetHeader>(receiptQuery, [
        data.partnerId ? Number(data.partnerId) : null,
        data.partnerId ? null : primaryExternalTicketId,
        JSON.stringify(paymentIds),
        totalConsolidated,
        latestPaymentDate,
        Number(data.registeredBy),
        obsList.length > 0 ? obsList.join(' | ') : null
      ])
      const receiptId = receiptResult.insertId

      // Asociar receiptId a todos los pagos insertados
      const placeholders = paymentIds.map(() => '?').join(',')
      await connection.execute(
        `UPDATE \`payments\` SET \`receiptId\` = ? WHERE \`id\` IN (${placeholders})`,
        [receiptId, ...paymentIds]
      )

      // Si se activó el botón "Al día" en ahorro programado, actualizar partners en BD
      if (data.markSavingsUpToDate && data.partnerId) {
        await connection.execute(
          `UPDATE \`partners\` SET \`statusValue\` = 'Al día', \`savingsUpToDateAt\` = ? WHERE \`id\` = ?`,
          [latestPaymentDate, Number(data.partnerId)]
        )
      }

      await connection.commit()
      return { receiptId, paymentIds }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
