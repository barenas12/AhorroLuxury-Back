import { Router } from 'express'
import { PaymentsController } from './payments.controller'
import { validatePayment } from './payments.middleware'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'

const router = Router()
const controller = new PaymentsController()

router.get('/', requireAuth(), requireRole(1, 2, 3), (req, res) => controller.list(req, res))
router.get('/consolidated', requireAuth(), requireRole(1, 2, 3), (req, res) =>
  controller.listConsolidated(req, res)
)
router.get('/partners', requireAuth(), requireRole(1), (req, res) =>
  controller.getPartners(req, res)
)
router.post('/', requireAuth(), requireRole(1), validatePayment, (req, res) =>
  controller.create(req, res)
)

export default router
