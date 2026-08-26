import { Router } from "express";
import { usuarioController } from "../controllers/usuario.controller.js";
import { autenticar, soloAdmin } from "../middlewares/autenticar.js";
import { validar } from "../middlewares/validar.js";
import { empleadoSchema } from "../schemas/usuario.schema.js";

export const usuarioRoutes = Router();

// Gestionar el equipo es tarea del dueño (admin).
usuarioRoutes.use(autenticar);

usuarioRoutes.get("/", soloAdmin, usuarioController.listar);
usuarioRoutes.post("/", soloAdmin, validar(empleadoSchema), usuarioController.crear);
usuarioRoutes.delete("/:id", soloAdmin, usuarioController.eliminar);
