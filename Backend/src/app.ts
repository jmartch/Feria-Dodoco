import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { limiteGeneral } from "./middlewares/limites.js";
import { manejarErrores } from "./middlewares/manejarErrores.js";
import { authRoutes } from "./routes/auth.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(limiteGeneral);

  app.get("/health", (_req, res) => {
    res.json({ estado: "ok" });
  });

  app.use("/auth", authRoutes);

  app.use(manejarErrores);
  return app;
}
