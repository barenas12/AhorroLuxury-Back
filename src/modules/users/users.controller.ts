import { Request, Response } from "express";
import { UsersService } from "./users.service";

const usersService = new UsersService();

export class UsersController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const statusParam =
        req.query.status !== undefined ? Number(req.query.status) : undefined;
      const users = await usersService.getAllUsers(statusParam);
      res.status(200).json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCoordinators(_req: Request, res: Response): Promise<void> {
    try {
      const coordinators = await usersService.getCoordinators();
      res.status(200).json({ success: true, data: coordinators });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      await usersService.createUser(req.body);
      res
        .status(201)
        .json({ success: true, message: "Usuario creado exitosamente." });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      await usersService.updateUser(req.body);
      res
        .status(200)
        .json({ success: true, message: "Usuario actualizado exitosamente." });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, status } = req.body;
      await usersService.togglePartnerStatus(documentId, status);
      res
        .status(200)
        .json({
          success: true,
          message: "Estado del ahorro en partners actualizado correctamente.",
        });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.body;
      if (!documentId) {
        res
          .status(400)
          .json({ success: false, message: "El documento es requerido." });
        return;
      }
      await usersService.resetPassword(documentId);
      res.status(200).json({
        success: true,
        message:
          "Contraseña restablecida correctamente al documento del usuario.",
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async changePasswordFirstLogin(req: Request, res: Response): Promise<void> {
    try {
      const { username, newPassword } = req.body;
      await usersService.updatePasswordFirstLogin(username, newPassword);
      res
        .status(200)
        .json({ success: true, message: "Contraseña cambiada exitosamente." });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getRaffle(req: Request, res: Response): Promise<void> {
    try {
      const type = req.params.type === "2" ? "2" : "1";
      const board = await usersService.getRaffleBoard(type);
      res.status(200).json({ success: true, data: board });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
