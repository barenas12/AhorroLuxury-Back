<<<<<<< HEAD
import { Router } from 'express'
import { LoginController } from './login.controller'
import { validateLoginPayload } from './login.middleware'

const router = Router()
const loginController = new LoginController()

// POST /api/login/check-user
router.post('/check-user', validateLoginPayload, (req, res) => {
  loginController.findUser(req, res)
})

=======
import { Router } from 'express'
import { LoginController } from './login.controller'
import { validateLoginPayload } from './login.middleware'

const router = Router()
const loginController = new LoginController()

// POST /api/login/check-user
router.post('/check-user', validateLoginPayload, (req, res) => {
  loginController.findUser(req, res)
})

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
export default router