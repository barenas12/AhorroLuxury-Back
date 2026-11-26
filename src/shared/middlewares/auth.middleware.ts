import { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../config/database'
import { AppError } from '../errors/AppError'

export type UserProfile = 1 | 2 | 3

export interface AuthUser {
  id: number
  partnerId: number | null
  user: string
  name: string
  lastName: string
  full_name: string
  profile: UserProfile
  resetPassword: number
}

interface AuthTokenPayload extends JwtPayload {
  sub: string
  profile: UserProfile
  partnerId: number | null
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

const JWT_ISSUER = 'ahorro-luxury-api'

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET es obligatorio y debe tener al menos 32 caracteres. Configúralo en las variables de entorno.'
    )
  }
  return secret
}

export function normalizeProfile(raw: unknown): UserProfile {
  const n = Number(raw)
  if (n === 1) return 1
  if (n === 2) return 2
  return 3
}

export function signAuthToken(user: {
  id: number
  profile: number
  partnerId: number | null
}): string {
  const secret = getJwtSecret()
  const expiresIn = (process.env.JWT_EXPIRES_IN?.trim() || '8h') as SignOptions['expiresIn']

  return jwt.sign(
    {
      profile: normalizeProfile(user.profile),
      partnerId: user.partnerId
    },
    secret,
    {
      algorithm: 'HS256',
      subject: String(user.id),
      issuer: JWT_ISSUER,
      expiresIn
    }
  )
}

export interface RequireAuthOptions {
  allowPasswordReset?: boolean
}

export function requireAuth(options: RequireAuthOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Sesión requerida. Inicia sesión para continuar.', 401)
      }

      const token = authHeader.slice(7).trim()
      if (!token) {
        throw new AppError('Token de autenticación ausente.', 401)
      }

      let decoded: AuthTokenPayload
      try {
        decoded = jwt.verify(token, getJwtSecret(), {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER
        }) as AuthTokenPayload
      } catch {
        throw new AppError('Sesión inválida o expirada. Inicia sesión nuevamente.', 401)
      }

      const userId = Number(decoded.sub)
      if (!userId || Number.isNaN(userId)) {
        throw new AppError('Token inválido.', 401)
      }

      // Verificar estado actual y perfil autoritativo en BD
      const [rows] = await dbPool.execute<RowDataPacket[]>(
        `
          SELECT
            u.\`id\`,
            p.\`id\` AS \`partnerId\`,
            u.\`name\`,
            u.\`lastName\`,
            CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`full_name\`,
            u.\`profile\`,
            u.\`user\`,
            u.\`resetPassword\`,
            u.\`status\` AS \`userStatus\`,
            COALESCE(p.\`status\`, 0) AS \`partnerStatus\`
          FROM \`users\` u
          LEFT JOIN \`partners\` p
            ON CAST(u.\`user\` AS CHAR(100)) = CAST(p.\`documentId\` AS CHAR(100))
          WHERE u.\`id\` = ?
          LIMIT 1
        `,
        [userId]
      )

      if (!rows || rows.length === 0) {
        throw new AppError('Sesión inválida.', 401)
      }

      const record = rows[0]
      if (Number(record.userStatus) !== 1 || Number(record.partnerStatus) !== 1) {
        throw new AppError('Usuario inactivo. Comuníquese con el administrador del sistema.', 403)
      }

      const resetPassword = Number(record.resetPassword) === 1 ? 1 : 0
      if (resetPassword === 1 && !options.allowPasswordReset) {
        throw new AppError(
          'Debes cambiar tu contraseña de primer ingreso antes de acceder a este recurso.',
          403
        )
      }

      req.authUser = {
        id: Number(record.id),
        partnerId: record.partnerId ? Number(record.partnerId) : null,
        user: String(record.user),
        name: String(record.name || ''),
        lastName: String(record.lastName || ''),
        full_name: String(record.full_name || ''),
        profile: normalizeProfile(record.profile),
        resetPassword
      }

      next()
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message
        })
        return
      }
      console.error('[Auth Middleware Error]', error)
      res.status(500).json({
        success: false,
        message: 'Error al validar la sesión.'
      })
    }
  }
}

export function requireRole(...allowedProfiles: UserProfile[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({
        success: false,
        message: 'Sesión requerida.'
      })
      return
    }

    if (!allowedProfiles.includes(req.authUser.profile)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción.'
      })
      return
    }

    next()
  }
}
