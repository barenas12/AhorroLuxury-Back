import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

const createEgressSchema = z.object({
  concept: z.string().trim().min(1, 'El concepto del egreso es obligatorio.').max(200),
  amount: z.coerce
    .number({ message: 'El valor del egreso debe ser numérico.' })
    .positive('El valor del egreso debe ser mayor a $0.')
    .max(10_000_000_000),
  paymentMethod: z.enum(['efectivo', 'transferencia'], {
    message: 'El método de pago debe ser "efectivo" o "transferencia".'
  }),
  recipient: z.string().trim().min(1, 'El beneficiario es obligatorio.').max(200),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha del egreso debe tener formato YYYY-MM-DD.'),
  observations: z.string().trim().max(500).optional().default('')
})

export const validateCreateEgress = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = createEgressSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de egreso inválidos.'
    })
    return
  }

  req.body = parsed.data
  next()
}
