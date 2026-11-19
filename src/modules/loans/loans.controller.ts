import { Request, Response } from 'express'
import { LoansService } from './loans.service'

const loansService = new LoansService()

export class LoansController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const data = await loansService.getAllLoans()
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async getLoanReceipts(req: Request, res: Response): Promise<void> {
    try {
      const loanId = Number(req.params.id)
      const data = await loansService.getLoanReceipts(loanId)
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const id = await loansService.createLoan(req.body)
      res.status(201).json({ success: true, id, message: 'Préstamo registrado exitosamente.' })
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message })
    }
  }

  async registerPayment(req: Request, res: Response): Promise<void> {
    try {
      const loanId = Number(req.params.id)
      const result = await loansService.registerMixedPayment(loanId, req.body)
      res.status(200).json({
        success: true,
        receiptId: result.receiptId,
        paymentIds: result.paymentIds,
        condonedNow: result.condonedNow,
        message: 'Pago de préstamo registrado correctamente.'
      })
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message })
    }
  }

  async updateInterest(req: Request, res: Response): Promise<void> {
    try {
      const loanId = Number(req.params.id)
      const data = await loansService.updateLoanInterest(loanId, req.body)
      res.status(200).json({
        success: true,
        data,
        message: 'Intereses del préstamo actualizados correctamente.'
      })
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message })
    }
  }
}
