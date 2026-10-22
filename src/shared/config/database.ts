<<<<<<< HEAD
import mysql, { Pool } from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

// 1. Configuración del Pool de conexiones
export const dbPool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ahorro_luxury_db',
  waitForConnections: true,
  connectionLimit: 10,        // Máximo 10 conexiones simultáneas
  maxIdle: 10,               // Conexiones inactivas permitidas
  idleTimeout: 60000,        // Tiempo antes de cerrar conexión inactiva (ms)
  queueLimit: 0,             // Sin límite de peticiones en cola
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

// 2. Función para testear la conexión al levantar el backend
export const testDbConnection = async (): Promise<void> => {
  try {
    const connection = await dbPool.getConnection()
    console.log(' Conexión a la base de datos MySQL establecida exitosamente.')
    connection.release() // Liberar la conexión de prueba de vuelta al pool
  } catch (error: unknown) {
    console.error('❌ Error crítico al conectar a la base de datos MySQL:')
    if (error instanceof Error) {
      console.error(`Mensaje: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exit(1) // Detiene el proceso si no hay conexión a la BD
  }
=======
import mysql, { Pool } from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

// 1. Configuración del Pool de conexiones
export const dbPool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ahorro_luxury_db',
  waitForConnections: true,
  connectionLimit: 10,        // Máximo 10 conexiones simultáneas
  maxIdle: 10,               // Conexiones inactivas permitidas
  idleTimeout: 60000,        // Tiempo antes de cerrar conexión inactiva (ms)
  queueLimit: 0,             // Sin límite de peticiones en cola
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
})

// 2. Función para testear la conexión al levantar el backend
export const testDbConnection = async (): Promise<void> => {
  try {
    const connection = await dbPool.getConnection()
    console.log(' Conexión a la base de datos MySQL establecida exitosamente.')
    connection.release() // Liberar la conexión de prueba de vuelta al pool
  } catch (error: unknown) {
    console.error('❌ Error crítico al conectar a la base de datos MySQL:')
    if (error instanceof Error) {
      console.error(`Mensaje: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exit(1) // Detiene el proceso si no hay conexión a la BD
  }
>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
}