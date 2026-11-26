import { Router } from 'express'
import { LoginController } from './login.controller'
import { validateLoginPayload } from './login.middleware'
import { loginRateLimiter } from '../../shared/middlewares/rateLimit.middleware'
import { requireAuth } from '../../shared/middlewares/auth.middleware'

const router = Router()
const loginController = new LoginController()

// POST /api/login/check-user
router.post('/check-user', loginRateLimiter, validateLoginPayload, (req, res) => {
  loginController.findUser(req, res)
})

// GET /api/login/me (valida token activo y devuelve perfil autoritativo desde BD)
router.get('/me', requireAuth({ allowPasswordReset: true }), (req, res) => {
  loginController.getMe(req, res)
})

export default router
