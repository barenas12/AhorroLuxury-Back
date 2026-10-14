import { Request, Response, NextFunction } from 'express'

export const validateLoginPayload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { user, password } = req.body

  if (!user || typeof user !== 'string' || user.trim() === '') {
    res.status(400).json({
      success: false,
      message: 'El campo "usuario" es requerido.'
    })
    return
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({
      success: false,
      message: 'El campo "contraseña" es requerido.'
    })
    return
  }

  next()
}