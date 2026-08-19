import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { autenticar, soloAdmin } from "../src/middlewares/autenticar.js";
import { validar } from "../src/middlewares/validar.js";
import { manejarErrores } from "../src/middlewares/manejarErrores.js";
import { crearLimitador } from "../src/middlewares/limites.js";
import { firmarAccessToken } from "../src/services/token.service.js";
import { createApp } from "../src/app.js";

function appDePrueba() {
  const app = express();
  app.use(express.json());

  app.get("/privado", autenticar, (req, res) => {
    res.json({ emprendimientoId: req.auth!.emprendimientoId });
  });

  app.get("/solo-admin", autenticar, soloAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/validado",
    validar(z.object({ nombre: z.string().min(1) })),
    (_req, res) => res.json({ ok: true }),
  );

  app.use(manejarErrores);
  return app;
}

const vendedor = {
  id: "u1",
  email: "v@d.co",
  nombre: "Vendedor",
  rol: "VENDEDOR" as const,
  emprendimientoId: "emp-1",
};

describe("middlewares", () => {
  it("rechaza sin token con 401", async () => {
    const res = await request(appDePrueba()).get("/privado");

    expect(res.status).toBe(401);
  });

  it("acepta con token válido y expone el emprendimiento", async () => {
    const token = firmarAccessToken(vendedor);

    const res = await request(appDePrueba())
      .get("/privado")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.emprendimientoId).toBe("emp-1");
  });

  it("bloquea a un vendedor en una ruta de admin con 403", async () => {
    const token = firmarAccessToken(vendedor);

    const res = await request(appDePrueba())
      .get("/solo-admin")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("devuelve 400 en español cuando el cuerpo es inválido", async () => {
    const res = await request(appDePrueba()).post("/validado").send({});

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
    expect(Array.isArray(res.body.detalles)).toBe(true);
  });

  // Los limitadores de la aplicación se desactivan bajo pruebas, así que aquí se
  // construye uno propio que anula ese `skip` para comprobar que sí bloquea.
  it("el limitador responde 429 al superar el límite", async () => {
    const app = express();
    app.use(
      crearLimitador({
        windowMs: 60_000,
        limit: 1,
        skip: () => false,
        message: { codigo: "DEMASIADAS_PETICIONES", mensaje: "Espera un momento" },
      }),
    );
    app.get("/x", (_req, res) => {
      res.json({ ok: true });
    });

    expect((await request(app).get("/x")).status).toBe(200);

    const bloqueada = await request(app).get("/x");
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.codigo).toBe("DEMASIADAS_PETICIONES");
  });

  it("un JSON malformado devuelve 400 con JSON_INVALIDO", async () => {
    const res = await request(createApp())
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{ esto no es json");

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("JSON_INVALIDO");
  });

  it("una ruta inexistente devuelve 404 RUTA_NO_ENCONTRADA en JSON", async () => {
    const res = await request(createApp()).get("/no-existe");

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe("RUTA_NO_ENCONTRADA");
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});
