// src/modules/login/login.service.ts
import { RowDataPacket } from 'mysql2'
import { dbPool } from '../../shared/config/database'

export interface UserRecord extends RowDataPacket {
  id: number
  partnerId: number | null
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
  async getUserByUsername(username: string): Promise<UserRecord | null> {
    if (!username || typeof username !== 'string') {
      return null
    }

    const cleanUsername = String(username).trim()
    if (!cleanUsername) {
      return null
    }

    const query = `
      SELECT 
        u.\`id\`,
        p.\`id\` AS \`partnerId\`,
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
      return null
    }

    return rows[0]
  }
}
