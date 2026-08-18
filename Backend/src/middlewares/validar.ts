import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validar(esquema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resultado = esquema.safeParse(req.body);

    if (!resultado.success) {
      res.status(400).json({
        codigo: "DATOS_INVALIDOS",
        mensaje: "Revisa los datos enviados",
        detalles: resultado.error.issues.map((i) => ({
          campo: i.path.join("."),
          problema: i.message,
        })),
      });
      return;
    }

    req.body = resultado.data;
    next();
  };
}
