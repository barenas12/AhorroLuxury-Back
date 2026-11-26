import mysql, { Pool } from 'mysql2/promise'
import fs from 'fs'

const isProduction = process.env.NODE_ENV === 'production'

const dbHost = process.env.DB_HOST?.trim() || (isProduction ? '' : 'localhost')
const dbUser = process.env.DB_USER?.trim() || (isProduction ? '' : 'root')
const dbPassword = process.env.DB_PASSWORD ?? (isProduction ? '' : '')
const dbName = process.env.DB_NAME?.trim() || (isProduction ? '' : 'luxury')

if (isProduction && (!dbHost || !dbUser || !dbName)) {
  throw new Error(
    'Configuración de base de datos incompleta: DB_HOST, DB_USER y DB_NAME son obligatorios en producción.'
  )
}

// 1. Configuración del Pool de conexiones (soporta MySQL local y TiDB Cloud con TLS)
const isLocal = !dbHost || dbHost === 'localhost' || dbHost === '127.0.0.1'

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
  host: dbHost,
  port: Number(process.env.DB_PORT) || 3306,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,        // Máximo 10 conexiones simultáneas
  maxIdle: 10,                // Conexiones inactivas permitidas
  idleTimeout: 60000,         // Tiempo antes de cerrar conexión inactiva (ms)
  queueLimit: 50,             // Límite de peticiones en cola para evitar agotamiento de memoria
  connectTimeout: 10000,      // Timeout de conexión (ms)
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
