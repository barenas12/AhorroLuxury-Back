import { Request, Response, NextFunction } from 'express'

export class LoansMiddleware {
  validateCreate(req: Request, res: Response, next: NextFunction): void {
    // 1. Añadimos dueDate a la extracción
    const { partnerId, initialCapital, interestRate, deliveryMethod, guarantee, deliveryDate, termDays, dueDate } = req.body

    // 2. Añadimos !dueDate a la condición de campos obligatorios
    if (!partnerId || !initialCapital || interestRate === undefined || !deliveryMethod || !guarantee || !deliveryDate || !termDays || !dueDate) {
      res.status(400).json({ 
        success: false, 
        message: 'Faltan campos obligatorios para registrar el préstamo (socio, capital, interés, método, garantía, fecha de entrega, plazo o fecha límite).' 
      })
      return
    }

    if (Number(initialCapital) <= 0) {
      res.status(400).json({ success: false, message: 'El capital prestado debe ser mayor a $0.' })
      return
    }

    next()
  }

  validatePayment(req: Request, res: Response, next: NextFunction): void {
    const { capitalEfectivo, capitalTransferencia, interesEfectivo, interesTransferencia } = req.body

    const total = 
      Number(capitalEfectivo || 0) + 
      Number(capitalTransferencia || 0) + 
      Number(interesEfectivo || 0) + 
      Number(interesTransferencia || 0)

    if (total <= 0) {
      res.status(400).json({ success: false, message: 'El valor total del abono debe ser mayor a $0.' })
      return
    }

    next()
  }
}