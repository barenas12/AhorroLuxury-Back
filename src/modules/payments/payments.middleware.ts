import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

const paymentItemSchema = z
  .object({
    concept: z.string().trim().min(1, 'El concepto es obligatorio.').max(150),
    ticketNumber: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim())),
    raffleType: z.coerce
      .number()
      .int()
      .refine((v) => v === 1 || v === 2, 'Tipo de rifa inválido.')
      .nullable()
      .optional(),
    externalTicketId: z.coerce.number().int().positive().nullable().optional(),
    amount: z.coerce
      .number({ message: 'El monto debe ser numérico.' })
      .min(0, 'El monto no puede ser negativo.')
      .max(10_000_000_000),
    paymentMethod: z.enum(['efectivo', 'transferencia'], {
      message: 'El método de pago debe ser "efectivo" o "transferencia".'
    }),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha del pago debe tener formato YYYY-MM-DD.'),
    observations: z.string().trim().max(500).optional().default(''),
    hasFine: z.boolean().default(false),
    fineAmount: z.coerce
      .number({ message: 'El valor de la multa debe ser numérico.' })
      .min(0, 'La multa no puede ser negativa.')
      .max(10_000_000_000)
      .optional()
      .default(0)
  })
  .refine(
    (it) => {
      const fine = it.hasFine ? Number(it.fineAmount || 0) : 0
      return Number(it.amount || 0) + fine > 0
    },
    { message: 'Cada concepto debe tener un monto de abono o multa mayor a $0.' }
  )

const createPaymentsSchema = z
  .object({
    partnerId: z.coerce.number().int().positive().nullable().optional(),
    externalTicketId: z.coerce.number().int().positive().nullable().optional(),
    markSavingsUpToDate: z.boolean().optional().default(false),
    items: z
      .array(paymentItemSchema)
      .min(1, 'Debe ingresar al menos una fila de abono.')
      .max(50, 'Se permiten máximo 50 conceptos por recibo.')
  })
  .refine(
    (data) => {
      const hasAnyExternalItem = data.items.some((it) => Boolean(it.externalTicketId))
      return Boolean(data.partnerId || data.externalTicketId || hasAnyExternalItem)
    },
    { message: 'Debe seleccionar un socio o un comprador externo de boleta.' }
  )

export const validatePayment = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = createPaymentsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de pago inválidos.'
    })
    return
  }

  req.body = parsed.data
  next()
}
