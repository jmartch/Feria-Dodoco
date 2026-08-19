import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { usuarioRepository } from "../repositories/usuario.repository.js";

export const authController = {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await authService.registrar(req.body);
      res.status(201).json({ usuario });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const sesion = await authService.login(req.body.email, req.body.password);
      res.json(sesion);
    } catch (error) {
      next(error);
    }
  },

  async refrescar(req: Request, res: Response, next: NextFunction) {
    try {
      const sesion = await authService.refrescar(req.body.refreshToken);
      res.json(sesion);
    } catch (error) {
      next(error);
    }
  },

  async yo(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await usuarioRepository.buscarPorId(
        { emprendimientoId: req.auth!.emprendimientoId },
        req.auth!.usuarioId,
      );
      res.json(usuario);
    } catch (error) {
      next(error);
    }
  },
};
