import type { NextFunction, Request, Response } from "express";
import { verificarAccessToken } from "../services/token.service.js";
import type { Rol } from "../repositories/usuario.repository.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { usuarioId: string; emprendimientoId: string; rol: Rol };
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization ?? "";
  const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : "";

  if (!token) {
    res.status(401).json({ codigo: "NO_AUTENTICADO", mensaje: "Debes iniciar sesión" });
    return;
  }

  try {
    const payload = verificarAccessToken(token);
    req.auth = {
      usuarioId: payload.sub,
      emprendimientoId: payload.emprendimientoId,
      rol: payload.rol,
    };
    next();
  } catch {
    res.status(401).json({ codigo: "SESION_EXPIRADA", mensaje: "La sesión expiró" });
  }
}

export function soloAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.rol !== "ADMIN") {
    res.status(403).json({ codigo: "SIN_PERMISO", mensaje: "Solo el administrador puede hacer esto" });
    return;
  }
  next();
}
