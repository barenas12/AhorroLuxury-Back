import { Router } from 'express'
import { DashboardController } from './dashboard.controller'

const router = Router()
const controller = new DashboardController()

router.get('/summary', (req, res) => controller.getSummary(req, res))

export default router