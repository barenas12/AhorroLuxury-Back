import { Router } from 'express'
import { DashboardController } from './dashboard.controller'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'

const router = Router()
const controller = new DashboardController()

// Resumen financiero global: exclusivo Administrador
router.get('/summary', requireAuth(), requireRole(1), (req, res) =>
  controller.getSummary(req, res)
)

// Resumen personal / de grupo (alcance aplicado por rol en servidor)
router.get('/personal', requireAuth(), requireRole(1, 2, 3), (req, res) =>
  controller.getPersonalSummary(req, res)
)

export default router
