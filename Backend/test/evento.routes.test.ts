import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

async function registrarYEntrar(nombre: string, email: string) {
  await request(app).post("/auth/registro").send({
    nombreEmprendimiento: nombre,
    nombreUsuario: "Dueño",
    email,
    password: "clave-segura-123",
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password: "clave-segura-123" });

  return login.body.accessToken as string;
}

async function crearEvento(token: string) {
  const res = await request(app)
    .post("/eventos")
    .set("Authorization", `Bearer ${token}`)
    .send({ nombre: "Feria de abril", fechaInicio: new Date().toISOString(), meta: 1000000 });

  return res.body.id as string;
}

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de eventos", () => {
  it("crea un evento con la meta indicada y sin candado", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/eventos")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Feria de abril", fechaInicio: new Date().toISOString(), meta: 1000000 });

    expect(res.status).toBe(201);
    expect(res.body.meta).toBe(1000000);
    expect(res.body.catalogoBloqueado).toBe(false);
  });

  it("un emprendimiento no ve los eventos de otro", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");
    await crearEvento(tokenB);

    const lista = await request(app)
      .get("/eventos")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(lista.body).toHaveLength(0);
  });

  it("no deja leer un evento de otro emprendimiento aunque se sepa su id", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");
    const ajeno = await crearEvento(tokenB);

    const res = await request(app)
      .get(`/eventos/${ajeno}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it("con el candado puesto rechaza añadir líneas y lo dice en español", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    await request(app)
      .patch(`/eventos/${eventoId}/candado`)
      .set("Authorization", `Bearer ${token}`)
      .send({ bloqueado: true });

    const res = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Improvisado", precio: 5000 });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe("CATALOGO_BLOQUEADO");
    expect(res.body.mensaje).toMatch(/candado/i);
  });

  it("añade una línea manual y la lista", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    const creada = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000 });

    expect(creada.status).toBe(201);
    expect(creada.body.origenTipo).toBe("MANUAL");

    const lista = await request(app)
      .get(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`);

    expect(lista.body).toHaveLength(1);
  });

  it("trae una categoría completa como una sola línea", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const eventoId = await crearEvento(token);

    const categoria = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Medias", precio: 15000 });

    const res = await request(app)
      .post(`/eventos/${eventoId}/lineas`)
      .set("Authorization", `Bearer ${token}`)
      .send({ categoriaId: categoria.body.id });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe("Medias");
    expect(res.body.precio).toBe(15000);
    expect(res.body.origenTipo).toBe("CATEGORIA");
  });
});
