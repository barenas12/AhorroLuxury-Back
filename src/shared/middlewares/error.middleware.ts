import { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError'

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    })
    return
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0]
    res.status(400).json({
      success: false,
      message: firstIssue?.message || 'Datos de entrada inválidos.'
    })
    return
  }

  // JSON malformado en el body
  if (
    err instanceof SyntaxError &&
    typeof (err as unknown as { status?: unknown }).status === 'number' &&
    (err as unknown as { status: number }).status === 400
  ) {
    res.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud contiene JSON inválido.'
    })
    return
  }

  // Error de CORS bloqueado
  if (err instanceof Error && err.message.startsWith('CORS_FORBIDDEN')) {
    res.status(403).json({
      success: false,
      message: 'Origen no permitido.'
    })
    return
  }

  console.error('[Error interno]', err)
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor.'
  })
}

/**
 * Envuelve controladores/middlewares para delegar errores al manejador global
 * sin exponer detalles de SQL ni stack traces al cliente.
 */
export function sendControllerError(res: Response, error: unknown, fallbackStatus = 500): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: error.issues[0]?.message || 'Datos de entrada inválidos.'
    })
    return
  }

  console.error('[Controller Error]', error)
  res.status(fallbackStatus).json({
    success: false,
    message: fallbackStatus >= 500 ? 'Error interno del servidor.' : 'No se pudo procesar la solicitud.'
  })
}
