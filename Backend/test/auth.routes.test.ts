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

  it("el token de un emprendimiento nunca expone datos de otro en /auth/yo", async () => {
    const cuerpoA = {
      nombreEmprendimiento: "Dodoco Store",
      email: "a@dodoco.co",
      password: "clave-segura-123",
      nombreUsuario: "Ana",
    };
    const cuerpoB = {
      nombreEmprendimiento: "Medias Pao",
      email: "b@medias.co",
      password: "clave-segura-456",
      nombreUsuario: "Beto",
    };

    await request(app).post("/auth/registro").send(cuerpoA);
    await request(app).post("/auth/registro").send(cuerpoB);

    const loginA = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoA.email, password: cuerpoA.password });
    const loginB = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoB.email, password: cuerpoB.password });

    expect(loginA.status).toBe(200);
    expect(loginB.status).toBe(200);
    expect(loginA.body.usuario.emprendimientoId).not.toBe(
      loginB.body.usuario.emprendimientoId,
    );

    const yoA = await request(app)
      .get("/auth/yo")
      .set("Authorization", `Bearer ${loginA.body.accessToken}`);

    expect(yoA.status).toBe(200);
    expect(yoA.body.email).toBe(cuerpoA.email);
    expect(yoA.body.emprendimientoId).toBe(loginA.body.usuario.emprendimientoId);
    expect(yoA.body.email).not.toBe(cuerpoB.email);
    expect(yoA.body.emprendimientoId).not.toBe(loginB.body.usuario.emprendimientoId);
  });

  it("POST /auth/refresh entrega un access token nuevo", async () => {
    await request(app).post("/auth/registro").send(cuerpoRegistro);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: cuerpoRegistro.email, password: cuerpoRegistro.password });

    const refresh = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });

    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();
    expect(refresh.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it("POST /auth/refresh sin cuerpo devuelve 400 DATOS_INVALIDOS", async () => {
    const res = await request(app).post("/auth/refresh").send();

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
  });
});
