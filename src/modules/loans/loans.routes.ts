import { Router } from 'express'
import { LoansController } from './loans.controller'
import { LoansMiddleware } from './loans.middleware'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'

const router = Router()
const controller = new LoansController()
const middleware = new LoansMiddleware()

router.get('/', requireAuth(), requireRole(1, 2, 3), (req, res) => controller.list(req, res))
router.get('/:id/receipts', requireAuth(), requireRole(1, 2, 3), (req, res) =>
  controller.getLoanReceipts(req, res)
)
router.post('/', requireAuth(), requireRole(1), middleware.validateCreate, (req, res) =>
  controller.create(req, res)
)
router.post('/:id/pay', requireAuth(), requireRole(1), middleware.validatePayment, (req, res) =>
  controller.registerPayment(req, res)
)
router.patch(
  '/:id/interest',
  requireAuth(),
  requireRole(1),
  middleware.validateUpdateInterest,
  (req, res) => controller.updateInterest(req, res)
)

export default router
