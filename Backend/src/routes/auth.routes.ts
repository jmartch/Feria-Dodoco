import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { validar } from "../middlewares/validar.js";
import { autenticar } from "../middlewares/autenticar.js";
import { limiteLogin } from "../middlewares/limites.js";
import { loginSchema, refreshSchema, registroSchema } from "../schemas/auth.schema.js";

export const authRoutes = Router();

authRoutes.post("/registro", limiteLogin, validar(registroSchema), authController.registrar);
authRoutes.post("/login", limiteLogin, validar(loginSchema), authController.login);
authRoutes.post("/refresh", validar(refreshSchema), authController.refrescar);
authRoutes.get("/yo", autenticar, authController.yo);
