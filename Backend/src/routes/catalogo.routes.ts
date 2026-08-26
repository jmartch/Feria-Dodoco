import { Router } from "express";
import { catalogoController } from "../controllers/catalogo.controller.js";
import { autenticar, soloAdmin } from "../middlewares/autenticar.js";
import { validar } from "../middlewares/validar.js";
import { categoriaSchema, metodoPagoSchema } from "../schemas/catalogo.schema.js";

export const catalogoRoutes = Router();

// Configurar el catálogo es tarea de quien administra el emprendimiento.
catalogoRoutes.use(autenticar);

catalogoRoutes.get("/categorias", catalogoController.listarCategorias);
catalogoRoutes.post("/categorias", soloAdmin, validar(categoriaSchema), catalogoController.crearCategoria);
catalogoRoutes.put("/categorias/:id", soloAdmin, validar(categoriaSchema), catalogoController.actualizarCategoria);
catalogoRoutes.delete("/categorias/:id", soloAdmin, catalogoController.eliminarCategoria);

catalogoRoutes.get("/metodos-pago", catalogoController.listarMetodos);
catalogoRoutes.post("/metodos-pago", soloAdmin, validar(metodoPagoSchema), catalogoController.crearMetodo);
catalogoRoutes.post("/metodos-pago/preajuste-bold", soloAdmin, catalogoController.preajusteBold);
