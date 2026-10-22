import { Request, Response, NextFunction } from 'express'

export const validatePayment = (req: Request, res: Response, next: NextFunction): void => {
  const { partnerId, registeredBy, items } = req.body

  if (!partnerId || !registeredBy) {
    res.status(400).json({
      success: false,
      message: 'El socio y el usuario registrador son requeridos.'
    })
    return
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Debe ingresar al menos una fila de abono.'
    })
    return
  }

  for (const it of items) {
    if (!it.concept || !it.paymentMethod || !it.paymentDate) {
      res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios de cada abono deben estar completos.'
      })
      return
    }

    if (isNaN(Number(it.amount)) || Number(it.amount) <= 0) {
      res.status(400).json({
        success: false,
        message: `El concepto "${it.concept}" debe tener un valor mayor a cero.`
      })
      return
    }
  }

  next()
}