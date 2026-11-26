import crypto from 'crypto'
import { AppError } from '../errors/AppError'

export interface PasswordValidationContext {
  documentId?: string | null
  name?: string | null
  lastName?: string | null
}

/**
 * Valida la política de contraseñas en el servidor (debe coincidir con el frontend).
 */
export function validatePasswordStrength(
  password: string,
  context?: PasswordValidationContext
): void {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400)
  }
  if (password.length > 128) {
    throw new AppError('La contraseña no puede superar los 128 caracteres.', 400)
  }
  if (!/[A-Z]/.test(password)) {
    throw new AppError('La contraseña debe incluir al menos una letra mayúscula.', 400)
  }
  if (!/[a-z]/.test(password)) {
    throw new AppError('La contraseña debe incluir al menos una letra minúscula.', 400)
  }
  if (!/\d/.test(password)) {
    throw new AppError('La contraseña debe incluir al menos un número.', 400)
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    throw new AppError('La contraseña debe incluir al menos un carácter especial.', 400)
  }

  if (context) {
    const lower = password.toLowerCase()
    const forbidden = [context.documentId, context.name, context.lastName]
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => v.length >= 3)

    for (const token of forbidden) {
      if (lower.includes(token)) {
        throw new AppError(
          'La contraseña no debe contener tu nombre, apellido o número de documento.',
          400
        )
      }
    }
  }
}

/**
 * Genera una contraseña temporal aleatoria y criptográficamente segura (12 caracteres)
 * que cumple todos los criterios de complejidad para el primer ingreso.
 */
export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&*?'
  const all = upper + lower + digits + symbols

  const pick = (charset: string): string => {
    const idx = crypto.randomInt(0, charset.length)
    return charset[idx]
  }

  const chars: string[] = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < length) {
    chars.push(pick(all))
  }

  // Mezcla Fisher-Yates con entropía criptográfica
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    const tmp = chars[i]
    chars[i] = chars[j]
    chars[j] = tmp
  }

  return chars.join('')
}
