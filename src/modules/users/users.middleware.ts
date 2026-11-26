import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

const ticketFieldSchema = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .optional()

const userFormSchema = z.object({
  id: z.coerce.number().int().nonnegative().optional(),
  documentId: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => v.length >= 3 && v.length <= 50, 'Documento inválido.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(100),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio.').max(100),
  savingsValue: z.coerce
    .number({ message: 'El Valor de Ahorro debe ser numérico.' })
    .min(0, 'El Valor de Ahorro no puede ser negativo.')
    .max(1_000_000_000),
  frequency: z.coerce
    .number({ message: 'La Frecuencia debe ser numérica.' })
    .refine((v) => [8, 15, 30].includes(v), 'La frecuencia debe ser 8, 15 o 30 días.'),
  savingsStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de inicio inválida (YYYY-MM-DD).')
    .nullable()
    .optional()
    .or(z.literal('')),
  cellphone: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => String(v ?? '').trim())
    .refine((v) => v === '' || /^\d{7,15}$/.test(v), 'El celular debe contener entre 7 y 15 dígitos.'),
  coordinator: z.coerce
    .number({ message: 'El coordinador debe ser un identificador numérico.' })
    .int()
    .nonnegative(),
  profile: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === 2 || v === 3, 'El perfil debe ser 1 (Admin), 2 (Coordinador) o 3 (Socio).'),
  canLogin: z.boolean().default(true),
  ticket: ticketFieldSchema,
  ticket2: ticketFieldSchema
})

const toggleStatusSchema = z.object({
  documentId: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => v.length >= 3 && v.length <= 50, 'Documento inválido.'),
  status: z.coerce.number().int().refine((v) => v === 0 || v === 1, 'El estado debe ser 0 o 1.')
})

const resetPasswordSchema = z.object({
  documentId: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => v.length >= 3 && v.length <= 50, 'El documento es requerido.')
})

const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres.')
    .max(128, 'La contraseña es demasiado larga.')
})

const assignRaffleTicketSchema = z.object({
  ticketNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d{1,2}$/.test(v), 'Número de boleta inválido (debe estar entre 00 y 99).'),
  assigneeType: z.enum(['partner', 'external']),
  partnerId: z.coerce.number().int().nonnegative().optional(),
  fullName: z.string().trim().max(150).optional(),
  cellphone: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => String(v ?? '').trim()),
  coordinatorId: z.coerce.number().int().nonnegative().optional()
})

export const validateUserForm = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = userFormSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de usuario inválidos.'
    })
    return
  }
  req.body = {
    ...parsed.data,
    savingsStartDate: parsed.data.savingsStartDate || null
  }
  next()
}

export const validateToggleStatus = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = toggleStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de estado inválidos.'
    })
    return
  }
  req.body = parsed.data
  next()
}

export const validateResetPassword = (req: Request, res: Response, next: NextFunction): void => {
  const rawDoc = req.params.documentId || req.body?.documentId
  const parsed = resetPasswordSchema.safeParse({ documentId: rawDoc })
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'El documento es requerido.'
    })
    return
  }
  req.body = { ...req.body, documentId: parsed.data.documentId }
  next()
}

export const validateChangePassword = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de contraseña inválidos.'
    })
    return
  }
  req.body = parsed.data
  next()
}

export const validateAssignRaffleTicket = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const parsed = assignRaffleTicketSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Datos de asignación de boleta inválidos.'
    })
    return
  }
  req.body = parsed.data
  next()
}
