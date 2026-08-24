import { Router } from "express";
import { eventoController } from "../controllers/evento.controller.js";
import { autenticar, soloAdmin } from "../middlewares/autenticar.js";
import { validar } from "../middlewares/validar.js";
import {
  candadoSchema,
  descuentoSchema,
  eventoSchema,
  lineaSchema,
} from "../schemas/evento.schema.js";

export const eventoRoutes = Router();

eventoRoutes.use(autenticar);

eventoRoutes.get("/", eventoController.listar);
eventoRoutes.post("/", soloAdmin, validar(eventoSchema), eventoController.crear);
eventoRoutes.get("/:id", eventoController.obtener);
eventoRoutes.patch("/:id/candado", soloAdmin, validar(candadoSchema), eventoController.cambiarCandado);

eventoRoutes.get("/:id/lineas", eventoController.listarLineas);
eventoRoutes.post("/:id/lineas", soloAdmin, validar(lineaSchema), eventoController.crearLinea);
eventoRoutes.delete("/:id/lineas/:lineaId", soloAdmin, eventoController.eliminarLinea);

eventoRoutes.get("/:id/descuentos", eventoController.listarDescuentos);
eventoRoutes.post("/:id/descuentos", soloAdmin, validar(descuentoSchema), eventoController.crearDescuento);
