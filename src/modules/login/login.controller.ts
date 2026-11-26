// src/modules/login/login.controller.ts
import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { LoginService } from './login.service'
import { signAuthToken } from '../../shared/middlewares/auth.middleware'
import { sendControllerError } from '../../shared/middlewares/error.middleware'

const loginService = new LoginService()

// Hash bcrypt válido usado como comparación ficticia para mitigar timing attacks / enumeración de usuarios
const DUMMY_BCRYPT_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8hN6l3u8sW8sE8W4Y4z5u6Z8o5v1mW'

export class LoginController {
  async findUser(req: Request, res: Response): Promise<void> {
    try {
      const { password: inputPassword } = req.body
      const targetUser = req.body.username || req.body.user || req.body.documentId

      if (!targetUser) {
        res.status(400).json({
          success: false,
          message: 'El nombre de usuario o documento es requerido.'
        })
        return
      }

      const user = await loginService.getUserByUsername(String(targetUser))

      if (!user || !user.password) {
        await bcrypt.compare(inputPassword, DUMMY_BCRYPT_HASH)
        res.status(401).json({
          success: false,
          message: 'Usuario o contraseña incorrectos.'
        })
        return
      }

      const passwordMatches = await bcrypt.compare(inputPassword, user.password)

      if (!passwordMatches) {
        res.status(401).json({
          success: false,
          message: 'Usuario o contraseña incorrectos.'
        })
        return
      }

      // Validación de estado en ambas tablas (partners y users)
      if (Number(user.partnerStatus) !== 1 || Number(user.userStatus) !== 1) {
        res.status(403).json({
          success: false,
          message: 'Usuario inactivo, comuníquese con el administrador del sistema.'
        })
        return
      }

      const { password: _password, ...safeUser } = user
      const token = signAuthToken({
        id: Number(safeUser.id),
        profile: Number(safeUser.profile),
        partnerId: safeUser.partnerId ? Number(safeUser.partnerId) : null
      })

      res.status(200).json({
        success: true,
        token,
        data: safeUser
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  getMe(req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      data: req.authUser
    })
  }
}
