import { Request, Response } from 'express'
import { PaymentsService } from './payments.service'

const paymentsService = new PaymentsService()

export class PaymentsController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const payments = await paymentsService.getAllPayments()
      res.status(200).json({ success: true, data: payments })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async listConsolidated(_req: Request, res: Response): Promise<void> {
    try {
      const receipts = await paymentsService.getConsolidatedReceipts()
      res.status(200).json({ success: true, data: receipts })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async getPartners(req: Request, res: Response): Promise<void> {
    try {
      const onlyPartners = req.query.onlyPartners === '1' || req.query.onlyPartners === 'true'
      const partners = await paymentsService.getActivePartners(onlyPartners)
      res.status(200).json({ success: true, data: partners })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await paymentsService.createMultiplePayments(req.body)
      res.status(201).json({
        success: true,
        receiptId: result.receiptId,
        paymentIds: result.paymentIds,
        message: 'Abonos registrados exitosamente.'
      })
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message })
    }
  }
}
