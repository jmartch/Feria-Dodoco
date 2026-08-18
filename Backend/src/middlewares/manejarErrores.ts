import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";

export function manejarErrores(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ErrorDeNegocio) {
    res.status(error.estado).json({ codigo: error.codigo, mensaje: error.message });
    return;
  }

  console.error("Error no controlado:", error);
  res.status(500).json({ codigo: "ERROR_INTERNO", mensaje: "Algo salió mal" });
}
