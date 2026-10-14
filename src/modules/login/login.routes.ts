import { Router } from 'express'
import { LoginController } from './login.controller'
import { validateLoginPayload } from './login.middleware'

const router = Router()
const loginController = new LoginController()

// POST /api/login/check-user
router.post('/check-user', validateLoginPayload, (req, res) => {
  loginController.findUser(req, res)
})

export default router