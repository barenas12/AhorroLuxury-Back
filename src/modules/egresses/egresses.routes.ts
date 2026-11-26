import { Router } from 'express'
import { EgressesController } from './egresses.controller'
import { validateCreateEgress } from './egresses.middleware'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'

const router = Router()
const controller = new EgressesController()

router.get('/', requireAuth(), requireRole(1), (req, res) => controller.list(req, res))
router.post('/', requireAuth(), requireRole(1), validateCreateEgress, (req, res) =>
  controller.create(req, res)
)

export default router
