// src/modules/login/login.controller.ts
import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { LoginService } from './login.service'

const loginService = new LoginService()

export class LoginController {
  async findUser(req: Request, res: Response): Promise<void> {
    try {
      const { password: inputPassword } = req.body
      // Extrae username, o user, o documentId según como lo envíe el frontend
      const targetUser = req.body.username || req.body.user || req.body.documentId

      if (!targetUser) {
        res.status(400).json({
          success: false,
          message: 'El nombre de usuario o documento es requerido'
        })
        return
      }

      const user = await loginService.getUserByUsername(String(targetUser))

      const passwordMatches = user.password
        ? await bcrypt.compare(inputPassword, user.password)
        : false

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
          message: 'Usuario Inactivo, comuníquese con el administrador del sistema.'
        })
        return
      }

      const { password, ...safeUser } = user

      res.status(200).json({
        success: true,
        data: safeUser
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'usuario no registrado') {
        res.status(404).json({
          success: false,
          message: 'usuario no registrado'
        })
        return
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor.'
      })
    }
  }
}