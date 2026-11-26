import { Router } from 'express'
import { UsersController } from './users.controller'
import {
  validateAssignRaffleTicket,
  validateChangePassword,
  validateResetPassword,
  validateToggleStatus,
  validateUserForm
} from './users.middleware'
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware'
import { sensitiveActionRateLimiter } from '../../shared/middlewares/rateLimit.middleware'

const router = Router()
const controller = new UsersController()

// Cambio de contraseña del usuario autenticado (permitido cuando resetPassword === 1)
router.post(
  '/change-password',
  requireAuth({ allowPasswordReset: true }),
  sensitiveActionRateLimiter,
  validateChangePassword,
  (req, res) => controller.changePasswordFirstLogin(req, res)
)

// Cuadrícula de rifas (alcance aplicado por rol en servidor)
router.get('/raffle/:type', requireAuth(), requireRole(1, 2, 3), (req, res) =>
  controller.getRaffle(req, res)
)

// Rutas administrativas exclusivas de Administrador (profile === 1)
router.get('/', requireAuth(), requireRole(1), (req, res) => controller.list(req, res))
router.get('/coordinators', requireAuth(), requireRole(1), (req, res) =>
  controller.getCoordinators(req, res)
)
router.post(
  '/raffle/:type/assign',
  requireAuth(),
  requireRole(1),
  validateAssignRaffleTicket,
  (req, res) => controller.assignRaffleTicket(req, res)
)

router.post('/', requireAuth(), requireRole(1), validateUserForm, (req, res) =>
  controller.create(req, res)
)
router.put('/', requireAuth(), requireRole(1), validateUserForm, (req, res) =>
  controller.update(req, res)
)
router.put('/:id', requireAuth(), requireRole(1), validateUserForm, (req, res) =>
  controller.update(req, res)
)

router.patch('/status', requireAuth(), requireRole(1), validateToggleStatus, (req, res) =>
  controller.toggleStatus(req, res)
)
router.post(
  '/reset-password',
  requireAuth(),
  requireRole(1),
  sensitiveActionRateLimiter,
  validateResetPassword,
  (req, res) => controller.resetPassword(req, res)
)
router.post(
  '/reset-password/:documentId',
  requireAuth(),
  requireRole(1),
  sensitiveActionRateLimiter,
  validateResetPassword,
  (req, res) => controller.resetPassword(req, res)
)

export default router
