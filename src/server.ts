import 'dotenv/config'
import app from './app'
import { testDbConnection } from './shared/config/database'
import { getJwtSecret } from './shared/middlewares/auth.middleware'

const PORT = process.env.PORT || 3000

const startServer = async (): Promise<void> => {
  // 1. Validar configuración crítica de seguridad antes de abrir puertos
  try {
    getJwtSecret()
  } catch (error) {
    console.error('❌ Error de configuración de seguridad:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  // 2. Probar conexión a la BD
  await testDbConnection()

  // 3. Levantar servidor HTTP
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Ahorro Luxury escuchando en http://localhost:${PORT}`)
    console.log(`📡 Healthcheck disponible en http://localhost:${PORT}/api/health`)
  })
}

startServer()
