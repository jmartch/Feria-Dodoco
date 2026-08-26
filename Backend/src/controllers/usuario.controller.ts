import type { NextFunction, Request, Response } from "express";
import { usuarioService } from "../services/usuario.service.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

export const usuarioController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usuarioService.listarEquipo(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const empleado = await usuarioService.crearEmpleado(scopeDe(req), req.body);
      res.status(201).json(empleado);
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      await usuarioService.eliminarEmpleado(scopeDe(req), String(req.params.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
};
