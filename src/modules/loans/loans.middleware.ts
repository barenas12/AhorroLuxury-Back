import { Request, Response, NextFunction } from 'express'

const ALLOWED_GUARANTEES = ['Oro', 'Prenda', 'Sin Prenda', 'Negocio', 'Otro']

export class LoansMiddleware {
  validateCreate(req: Request, res: Response, next: NextFunction): void {
    const { partnerId, initialCapital, interestRate, deliveryMethod, guarantee, deliveryDate, termDays } = req.body

    if (!partnerId || !initialCapital || interestRate === undefined || !deliveryMethod || !guarantee || !deliveryDate || !termDays) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios para registrar el préstamo (socio, capital, interés, método, garantía, fecha de entrega o plazo).'
      })
      return
    }

    if (!ALLOWED_GUARANTEES.includes(guarantee)) {
      res.status(400).json({
        success: false,
        message: `La garantía "${guarantee}" no es válida.`
      })
      return
    }

    if (Number(initialCapital) <= 0) {
      res.status(400).json({ success: false, message: 'El capital prestado debe ser mayor a $0.' })
      return
    }

    if (Number(interestRate) < 0) {
      res.status(400).json({ success: false, message: 'La tasa de interés no puede ser negativa.' })
      return
    }

    if (Number(termDays) <= 0) {
      res.status(400).json({ success: false, message: 'El plazo en días debe ser mayor a 0.' })
      return
    }

    next()
  }

  validatePayment(req: Request, res: Response, next: NextFunction): void {
    const { capitalEfectivo, capitalTransferencia, interesEfectivo, interesTransferencia, markInterestUpToDate } = req.body

    const total =
      Number(capitalEfectivo || 0) +
      Number(capitalTransferencia || 0) +
      Number(interesEfectivo || 0) +
      Number(interesTransferencia || 0)

    if (total <= 0 && !markInterestUpToDate) {
      res.status(400).json({
        success: false,
        message: 'El valor total del abono debe ser mayor a $0 o marcar intereses al día.'
      })
      return
    }

    next()
  }
}
