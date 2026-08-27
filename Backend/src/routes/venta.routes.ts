import { Router } from "express";
import { ventaController } from "../controllers/venta.controller.js";
import { validar } from "../middlewares/validar.js";
import { ventaEdicionSchema, ventaSchema } from "../schemas/venta.schema.js";

/**
 * `mergeParams` es necesario: estas rutas se montan bajo `/eventos/:id`, y sin
 * él `req.params.id` llegaría vacío al controlador.
 */
export const ventaRoutes = Router({ mergeParams: true });

ventaRoutes.post("/ventas", validar(ventaSchema), ventaController.registrar);
ventaRoutes.get("/ventas", ventaController.listar);
ventaRoutes.put("/ventas/:ventaId", validar(ventaEdicionSchema), ventaController.editar);
ventaRoutes.delete("/ventas/:ventaId", ventaController.eliminar);
ventaRoutes.get("/totales", ventaController.totales);
