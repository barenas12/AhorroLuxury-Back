import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

const ALLOWED_GUARANTEES = ['Oro', 'Prenda', 'Sin Prenda', 'Negocio', 'Otro'] as const

const createLoanSchema = z.object({
  partnerId: z.coerce.number().int().positive('Debes seleccionar un socio válido.'),
  initialCapital: z.coerce
    .number({ message: 'El capital prestado debe ser numérico.' })
    .positive('El capital prestado debe ser mayor a $0.')
    .max(10_000_000_000),
  interestMode: z.enum(['percentage', 'fixed']).optional().default('percentage'),
  interestRate: z.coerce
    .number({ message: 'La tasa de interés debe ser numérica.' })
    .min(0, 'La tasa de interés no puede ser negativa.')
    .max(1000)
    .default(0),
  fixedInterestAmount: z.coerce
    .number()
    .min(0, 'El valor de interés fijo no puede ser negativo.')
    .max(10_000_000_000)
    .nullable()
    .optional(),
  initialInterestAmount: z.coerce
    .number()
    .min(0, 'El interés inicial no puede ser negativo.')
    .max(10_000_000_000)
    .nullable()
    .optional(),
  deliveryMethod: z.enum(['efectivo', 'transferencia'], {
    message: 'El método de entrega debe ser "efectivo" o "transferencia".'
  }),
  guarantee: z.enum(ALLOWED_GUARANTEES, {
    message: 'La garantía seleccionada no es válida.'
  }),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de entrega debe tener formato YYYY-MM-DD.'),
  termDays: z.coerce
    .number({ message: 'El plazo en días debe ser numérico.' })
    .int()
    .positive('El plazo en días debe ser mayor a 0.')
    .max(3650),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento inválida.')
    .nullable()
    .optional()
    .or(z.literal('')),
  installments: z.coerce.number().int().positive().max(360).nullable().optional(),
  observations: z.string().trim().max(500).optional().default('')
})

const loanPaymentSchema = z
  .object({
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha del pago debe tener formato YYYY-MM-DD.')
      .optional(),
    observations: z.string().trim().max(500).optional().default(''),
    capitalEfectivo: z.coerce
      .number()
      .min(0, 'El abono a capital en efectivo no puede ser negativo.')
      .max(10_000_000_000)
      .default(0),
    capitalTransferencia: z.coerce
      .number()
      .min(0, 'El abono a capital por transferencia no puede ser negativo.')
      .max(10_000_000_000)
      .default(0),
    interesEfectivo: z.coerce
      .number()
      .min(0, 'El abono a interés en efectivo no puede ser negativo.')
      .max(10_000_000_000)
      .default(0),
    interesTransferencia: z.coerce
      .number()
      .min(0, 'El abono a interés por transferencia no puede ser negativo.')
      .max(10_000_000_000)
      .default(0),
    markInterestUpToDate: z.boolean().optional().default(false)
  })
  .refine(
    (data) => {
      const total =
        data.capitalEfectivo +
        data.capitalTransferencia +
        data.interesEfectivo +
        data.interesTransferencia
      return total > 0 || data.markInterestUpToDate
    },
    { message: 'El valor total del abono debe ser mayor a $0 o marcar intereses al día.' }
  )

const updateInterestSchema = z.object({
  interestMode: z.enum(['percentage', 'fixed']).optional(),
  interestRate: z.coerce
    .number()
    .min(0, 'La tasa de interés no puede ser negativa.')
    .max(1000)
    .optional(),
  fixedInterestAmount: z.coerce
    .number()
    .min(0, 'El valor de interés fijo no puede ser negativo.')
    .max(10_000_000_000)
    .nullable()
    .optional(),
  targetRemainingInterest: z.coerce
    .number()
    .min(0, 'El interés pendiente no puede ser negativo.')
    .max(10_000_000_000)
    .optional()
})

export class LoansMiddleware {
  validateCreate(req: Request, res: Response, next: NextFunction): void {
    const parsed = createLoanSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Datos de préstamo inválidos.'
      })
      return
    }
    req.body = {
      ...parsed.data,
      dueDate: parsed.data.dueDate || null
    }
    next()
  }

  validatePayment(req: Request, res: Response, next: NextFunction): void {
    const parsed = loanPaymentSchema.safeParse(req.body)
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

  validateUpdateInterest(req: Request, res: Response, next: NextFunction): void {
    const parsed = updateInterestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || 'Datos de interés inválidos.'
      })
      return
    }
    req.body = parsed.data
    next()
  }
}
