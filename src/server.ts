<<<<<<< HEAD
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

=======
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

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
startServer()