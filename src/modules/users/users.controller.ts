import { Request, Response } from 'express'
import { UsersService } from './users.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'
import { sendControllerError } from '../../shared/middlewares/error.middleware'
import { signAuthToken } from '../../shared/middlewares/auth.middleware'
import { AppError } from '../../shared/errors/AppError'

const usersService = new UsersService()

export class UsersController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const statusParam =
        req.query.status !== undefined ? Number(req.query.status) : undefined
      const scope = resolveViewerScope(req)
      const users = await usersService.getAllUsers(statusParam, scope)
      res.status(200).json({ success: true, data: users })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async getCoordinators(_req: Request, res: Response): Promise<void> {
    try {
      const coordinators = await usersService.getCoordinators()
      res.status(200).json({ success: true, data: coordinators })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await usersService.createUser(req.body)
      res.status(201).json({
        success: true,
        temporaryPassword: result.temporaryPassword,
        message: 'Usuario creado exitosamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const payload = {
        ...req.body,
        id: Number(req.params.id || req.body.id)
      }
      await usersService.updateUser(payload)
      res.status(200).json({
        success: true,
        message: 'Usuario actualizado exitosamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, status } = req.body
      await usersService.togglePartnerStatus(documentId, status)
      res.status(200).json({
        success: true,
        message: 'Estado del ahorro en partners actualizado correctamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const documentId = String(req.body.documentId || '').trim()
      const { temporaryPassword } = await usersService.resetPassword(documentId)
      res.status(200).json({
        success: true,
        temporaryPassword,
        message:
          'Contraseña restablecida correctamente. Entrega la contraseña temporal al usuario para su próximo ingreso.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async changePasswordFirstLogin(req: Request, res: Response): Promise<void> {
    try {
      if (!req.authUser) {
        throw new AppError('Sesión requerida.', 401)
      }
      const { newPassword, currentPassword } = req.body
      await usersService.updatePasswordForAuthenticatedUser(
        req.authUser,
        newPassword,
        currentPassword
      )

      const refreshedToken = signAuthToken({
        id: req.authUser.id,
        profile: req.authUser.profile,
        partnerId: req.authUser.partnerId
      })

      res.status(200).json({
        success: true,
        token: refreshedToken,
        message: 'Contraseña cambiada exitosamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async getRaffle(req: Request, res: Response): Promise<void> {
    try {
      const type = String(req.params.type) === '2' ? '2' : '1'
      const scope = resolveViewerScope(req)
      const board = await usersService.getRaffleBoard(type, scope)
      res.status(200).json({ success: true, data: board })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async assignRaffleTicket(req: Request, res: Response): Promise<void> {
    try {
      const type = String(req.params.type) === '2' ? '2' : '1'
      const result = await usersService.assignRaffleTicket(type, req.body)
      res.status(201).json({
        success: true,
        data: result,
        message: `Boleta #${result.ticketNumber} asignada exitosamente en Rifa ${type}.`
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }
}
