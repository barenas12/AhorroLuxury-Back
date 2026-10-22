<<<<<<< HEAD
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
=======
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
>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
}