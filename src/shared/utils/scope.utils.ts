import { Request } from 'express'
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../config/database'

export interface ViewerScope {
  userId: number | null
  profile: 1 | 2 | 3
  doc: string | null
  ownPartnerId: number | null
}

/**
 * Resuelve el alcance del usuario autenticado a partir de los parámetros de consulta
 * o cabeceras enviadas por el frontend.
 * - profile 1 (Administrador): acceso total
 * - profile 2 (Coordinador): su información propia + socios que lo tienen como coordinador
 * - profile 3 (Socio): únicamente su información propia
 */
export async function resolveViewerScope(req: Request): Promise<ViewerScope> {
  const rawProfile = req.query.viewerProfile ?? req.headers['x-viewer-profile']
  const rawUserId = req.query.viewerId ?? req.headers['x-viewer-id']
  const rawDoc = req.query.viewerDoc ?? req.headers['x-viewer-doc']
  const rawPartnerId = req.query.viewerPartnerId ?? req.headers['x-viewer-partner-id']

  const parsedProfile = Number(rawProfile)
  const profile: 1 | 2 | 3 = parsedProfile === 2 ? 2 : parsedProfile === 3 ? 3 : 1
  const userId = rawUserId && !isNaN(Number(rawUserId)) ? Number(rawUserId) : null
  const doc = rawDoc ? String(rawDoc).trim() : null

  if (profile === 1) {
    return { userId, profile: 1, doc, ownPartnerId: null }
  }

  let ownPartnerId: number | null =
    rawPartnerId && !isNaN(Number(rawPartnerId)) && Number(rawPartnerId) > 0
      ? Number(rawPartnerId)
      : null

  // Resolver partnerId desde la BD usando documentId o users.id -> users.user
  if (!ownPartnerId && doc) {
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT \`id\` FROM \`partners\` WHERE CAST(\`documentId\` AS CHAR(100)) = ? LIMIT 1`,
      [doc]
    )
    if (rows.length > 0) ownPartnerId = Number(rows[0].id)
  }

  if (!ownPartnerId && userId) {
    const [rows] = await dbPool.execute<RowDataPacket[]>(
      `
        SELECT p.\`id\`
        FROM \`users\` u
        INNER JOIN \`partners\` p ON CAST(u.\`user\` AS CHAR(100)) = CAST(p.\`documentId\` AS CHAR(100))
        WHERE u.\`id\` = ?
        LIMIT 1
      `,
      [userId]
    )
    if (rows.length > 0) ownPartnerId = Number(rows[0].id)
  }

  return { userId, profile, doc, ownPartnerId }
}
