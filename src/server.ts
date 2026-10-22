import app from './app'
import dotenv from 'dotenv'
import { testDbConnection } from './shared/config/database'

dotenv.config()

const PORT = process.env.PORT || 3000

const startServer = async (): Promise<void> => {
  // 1. Probar conexión a la BD
  await testDbConnection()

  // 2. Levantar servidor HTTP
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Ahorro Luxury escuchando en http://localhost:${PORT}`)
    console.log(`📡 Healthcheck disponible en http://localhost:${PORT}/api/health`)
  })
}

startServer()