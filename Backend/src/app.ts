import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { limiteGeneral } from "./middlewares/limites.js";
import { manejarErrores } from "./middlewares/manejarErrores.js";
import { authRoutes } from "./routes/auth.routes.js";
import { catalogoRoutes } from "./routes/catalogo.routes.js";
import { eventoRoutes } from "./routes/evento.routes.js";
import { documentoOpenApi } from "./docs/openapi.js";

export function createApp(): Express {
  const app = express();

  // Railway sirve detrás de un proxy: sin esto, req.ip es la IP del proxy y todos
  // los clientes compartirían el mismo contador de límite de peticiones.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(limiteGeneral);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ estado: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/catalogo", catalogoRoutes);
  app.use("/eventos", eventoRoutes);

  app.get("/docs.json", (_req, res) => {
    res.json(documentoOpenApi);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(documentoOpenApi));

  app.use((_req, res) => {
    res.status(404).json({
      codigo: "RUTA_NO_ENCONTRADA",
      mensaje: "La ruta solicitada no existe",
    });
  });

  app.use(manejarErrores);
  return app;
}
