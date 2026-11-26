import { Request } from 'express'
import { AppError } from '../errors/AppError'

export interface ViewerScope {
  userId: number
  profile: 1 | 2 | 3
  doc: string
  ownPartnerId: number | null
}

/**
 * Resuelve el alcance del usuario EXCLUSIVAMENTE desde el token autenticado (req.authUser).
 * Nunca confía en parámetros query ni cabeceras enviadas por el cliente.
 * - profile 1 (Administrador): acceso total
 * - profile 2 (Coordinador): su información propia + socios que lo tienen como coordinador
 * - profile 3 (Socio): únicamente su información propia
 */
export function resolveViewerScope(req: Request): ViewerScope {
  if (!req.authUser) {
    throw new AppError('Sesión requerida para determinar el alcance de acceso.', 401)
  }

  return {
    userId: req.authUser.id,
    profile: req.authUser.profile,
    doc: req.authUser.user,
    ownPartnerId: req.authUser.partnerId
  }
}
