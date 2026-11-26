import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

const loginSchema = z
  .object({
    user: z.string().trim().min(1).max(100).optional(),
    username: z.string().trim().min(1).max(100).optional(),
    documentId: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(1, 'El campo "contraseña" es requerido.').max(128)
  })
  .refine((data) => Boolean(data.user || data.username || data.documentId), {
    message: 'El campo "usuario" es requerido.'
  })

export const validateLoginPayload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.issues[0]?.message || 'Credenciales incompletas.'
    })
    return
  }

  req.body = parsed.data
  next()
}
