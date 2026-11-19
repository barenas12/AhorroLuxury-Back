import { Router } from 'express'
import { DashboardController } from './dashboard.controller'

const router = Router()
const controller = new DashboardController()

router.get('/summary', (req, res) => controller.getSummary(req, res))
router.get('/personal', (req, res) => controller.getPersonalSummary(req, res))

export default router
