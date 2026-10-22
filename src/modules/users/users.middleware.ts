import { Request, Response, NextFunction } from 'express'

export const validateUserForm = (req: Request, res: Response, next: NextFunction): void => {
  const { documentId, name, lastName, savingsValue, frequency, cellphone } = req.body

  if (!documentId || !name || !lastName) {
    res.status(400).json({ success: false, message: 'Documento, nombre y apellido son obligatorios.' })
    return
  }

  if (isNaN(Number(savingsValue)) || isNaN(Number(frequency)) || isNaN(Number(cellphone))) {
    res.status(400).json({ success: false, message: 'Los campos Valor de Ahorro, Frecuencia y Celular deben ser numéricos.' })
    return
  }

  next()
}