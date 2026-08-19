import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";

/**
 * Forma mínima de los errores que lanza `body-parser` (usado internamente por
 * `express.json()`) para un cuerpo malformado o demasiado grande. No se importa
 * el tipo desde `body-parser` a propósito: basta con reconocer la forma del
 * objeto para no acoplarse a esa dependencia interna de Express.
 */
type ErrorDeCuerpo = {
  type: string;
  status?: number;
  statusCode?: number;
};

function esErrorDeCuerpo(error: unknown): error is ErrorDeCuerpo {
  if (typeof error !== "object" || error === null) return false;
  const posible = error as Record<string, unknown>;
  const estado = posible.status ?? posible.statusCode;
  return typeof posible.type === "string" && posible.type.startsWith("entity.") && typeof estado === "number";
}

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

  if (esErrorDeCuerpo(error)) {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({
        codigo: "JSON_INVALIDO",
        mensaje: "El cuerpo de la petición no es JSON válido",
      });
      return;
    }

    if (error.type === "entity.too.large") {
      res.status(413).json({
        codigo: "CUERPO_DEMASIADO_GRANDE",
        mensaje: "El cuerpo de la petición es demasiado grande",
      });
      return;
    }
  }

  console.error("Error no controlado:", error);
  res.status(500).json({ codigo: "ERROR_INTERNO", mensaje: "Algo salió mal" });
}
