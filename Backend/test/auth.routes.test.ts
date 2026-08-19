import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

const cuerpoRegistro = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de autenticación", () => {
  it("registra y devuelve el usuario sin datos sensibles", async () => {
    const res = await request(app).post("/auth/registro").send(cuerpoRegistro);

    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe("ADMIN");
    expect(res.body.usuario).not.toHaveProperty("passwordHash");
  });

  it("rechaza el registro con datos inválidos", async () => {
    const res = await request(app)
      .post("/auth/registro")
      .send({ ...cuerpoRegistro, email: "no-es-un-correo" });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
  });

  it("permite iniciar sesión y consultar el perfil propio", async () => {
    await request(app).post("/auth/registro").send(cuerpoRegistro);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoRegistro.email, password: cuerpoRegistro.password });

    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const yo = await request(app)
      .get("/auth/yo")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(yo.status).toBe(200);
    expect(yo.body.email).toBe(cuerpoRegistro.email);
  });

  it("devuelve 401 con credenciales incorrectas", async () => {
    await request(app).post("/auth/registro").send(cuerpoRegistro);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoRegistro.email, password: "equivocada" });

    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe("CREDENCIALES_INVALIDAS");
  });

  it("exige token para el perfil", async () => {
    const res = await request(app).get("/auth/yo");

    expect(res.status).toBe(401);
  });
});
