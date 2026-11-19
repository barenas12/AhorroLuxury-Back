import mysql, { Pool } from 'mysql2/promise'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

// 1. Configuración del Pool de conexiones (soporta MySQL local y TiDB Cloud con TLS)
const isLocal =
  !process.env.DB_HOST ||
  process.env.DB_HOST === 'localhost' ||
  process.env.DB_HOST === '127.0.0.1'

const buildSslConfig = () => {
  if (isLocal) return undefined
  const caPath = process.env.DB_CA_PATH?.trim()
  const ssl: { minVersion: string; rejectUnauthorized: boolean; ca?: string } = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
  if (caPath && fs.existsSync(caPath)) {
    ssl.ca = fs.readFileSync(caPath, 'utf8')
  }
  return ssl
}

const sslConfig = buildSslConfig()

export const dbPool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'luxury',
  waitForConnections: true,
  connectionLimit: 10,        // Máximo 10 conexiones simultáneas
  maxIdle: 10,                // Conexiones inactivas permitidas
  idleTimeout: 60000,         // Tiempo antes de cerrar conexión inactiva (ms)
  queueLimit: 0,              // Sin límite de peticiones en cola
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(sslConfig ? { ssl: sslConfig } : {})
})

// 2. Función para testear la conexión al levantar el backend
export const testDbConnection = async (): Promise<void> => {
  try {
    const connection = await dbPool.getConnection()
    console.log('Conexión a la base de datos MySQL/TiDB establecida exitosamente.')
    connection.release()
  } catch (error: unknown) {
    console.error('❌ Error crítico al conectar a la base de datos:')
    if (error instanceof Error) {
      console.error(`Mensaje: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}
