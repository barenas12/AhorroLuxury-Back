import { Request, Response } from 'express'
import { PaymentsService } from './payments.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'
import { sendControllerError } from '../../shared/middlewares/error.middleware'
import { AppError } from '../../shared/errors/AppError'

const paymentsService = new PaymentsService()

export class PaymentsController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const scope = resolveViewerScope(req)
      const payments = await paymentsService.getAllPayments(scope)
      res.status(200).json({ success: true, data: payments })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async listConsolidated(req: Request, res: Response): Promise<void> {
    try {
      const scope = resolveViewerScope(req)
      const receipts = await paymentsService.getConsolidatedReceipts(scope)
      res.status(200).json({ success: true, data: receipts })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async getPartners(req: Request, res: Response): Promise<void> {
    try {
      const onlyPartners = req.query.onlyPartners === '1' || req.query.onlyPartners === 'true'
      const partners = await paymentsService.getActivePartners(onlyPartners)
      res.status(200).json({ success: true, data: partners })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.authUser) {
        throw new AppError('Sesión requerida.', 401)
      }
      const result = await paymentsService.createMultiplePayments({
        ...req.body,
        registeredBy: req.authUser.id
      })
      res.status(201).json({
        success: true,
        receiptId: result.receiptId,
        paymentIds: result.paymentIds,
        message: 'Abonos registrados exitosamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }
}
