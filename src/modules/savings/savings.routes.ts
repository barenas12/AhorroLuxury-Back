import { Router } from 'express'
import { SavingsController } from './savings.controller'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'

const router = Router()
const controller = new SavingsController()

router.get('/dashboard', requireAuth(), requireRole(1, 2, 3), (req, res) =>
  controller.getDashboard(req, res)
)

export default router
