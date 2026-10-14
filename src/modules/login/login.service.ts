// src/modules/login/login.service.ts
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface UserRecord extends RowDataPacket {
  id: number
  name: string
  lastName: string
  full_name: string
  profile: number
  user: string
  password?: string
  resetPassword: number
  userStatus: number
  partnerStatus: number
}

export class LoginService {
  async getUserByUsername(username: string): Promise<UserRecord> {
    // Protección contra undefined / null / no string
    if (!username || typeof username !== 'string') {
      throw new Error('usuario no registrado')
    }

    const cleanUsername = String(username).trim()

    const query = `
      SELECT 
        u.\`id\`,
        u.\`name\`,
        u.\`lastName\`,
        CONCAT_WS(' ', u.\`name\`, u.\`lastName\`) AS \`full_name\`,
        u.\`profile\`,
        u.\`user\`,
        u.\`password\`,
        u.\`resetPassword\`,
        u.\`status\` AS \`userStatus\`,
        COALESCE(p.\`status\`, 0) AS \`partnerStatus\`
      FROM \`users\` u
      LEFT JOIN \`partners\` p 
        ON CAST(u.\`user\` AS CHAR(100)) = CAST(p.\`documentId\` AS CHAR(100))
      WHERE u.\`user\` = ?
      LIMIT 1
    `

    const [rows] = await dbPool.execute<UserRecord[]>(query, [cleanUsername])

    if (!rows || rows.length === 0) {
      throw new Error('usuario no registrado')
    }

    return rows[0]
  }
}