import { Request, Response } from 'express'
import { LoansService } from './loans.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'
import { sendControllerError } from '../../shared/middlewares/error.middleware'
import { AppError } from '../../shared/errors/AppError'

const loansService = new LoansService()

function parsePositiveId(raw: unknown, label: string): number {
  const num = Number(raw)
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(`${label} inválido.`, 400)
  }
  return num
}

export class LoansController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const scope = resolveViewerScope(req)
      const data = await loansService.getAllLoans(scope)
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async getLoanReceipts(req: Request, res: Response): Promise<void> {
    try {
      const loanId = parsePositiveId(req.params.id, 'ID de préstamo')
      const scope = resolveViewerScope(req)
      const data = await loansService.getLoanReceipts(loanId, scope)
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.authUser) {
        throw new AppError('Sesión requerida.', 401)
      }
      const id = await loansService.createLoan({
        ...req.body,
        registeredBy: req.authUser.id
      })
      res.status(201).json({ success: true, id, message: 'Préstamo registrado exitosamente.' })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async registerPayment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.authUser) {
        throw new AppError('Sesión requerida.', 401)
      }
      const loanId = parsePositiveId(req.params.id, 'ID de préstamo')
      const result = await loansService.registerMixedPayment(loanId, {
        ...req.body,
        registeredBy: req.authUser.id
      })
      res.status(200).json({
        success: true,
        receiptId: result.receiptId,
        paymentIds: result.paymentIds,
        condonedNow: result.condonedNow,
        message: 'Pago de préstamo registrado correctamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }

  async updateInterest(req: Request, res: Response): Promise<void> {
    try {
      const loanId = parsePositiveId(req.params.id, 'ID de préstamo')
      const data = await loansService.updateLoanInterest(loanId, req.body)
      res.status(200).json({
        success: true,
        data,
        message: 'Intereses del préstamo actualizados correctamente.'
      })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }
}
