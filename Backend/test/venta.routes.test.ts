import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { createApp } from "../src/app.js";

const app = createApp();

async function prepararFeria() {
  await request(app).post("/auth/registro").send({
    nombreEmprendimiento: "Dodoco",
    nombreUsuario: "Ana",
    email: "a@dodoco.co",
    password: "clave-segura-123",
  });

  const login = await request(app)
    .post("/auth/login")
    .send({ email: "a@dodoco.co", password: "clave-segura-123" });
  const token = login.body.accessToken as string;
  const auth = { Authorization: `Bearer ${token}` };

  const evento = await request(app)
    .post("/eventos")
    .set(auth)
    .send({ nombre: "Feria", fechaInicio: new Date().toISOString(), meta: 1000000 });

  const metodos = await request(app)
    .post("/catalogo/metodos-pago/preajuste-bold")
    .set(auth)
    .send({});

  const qr = metodos.body.find((m: { nombre: string }) => m.nombre === "QR");

  return { token, auth, eventoId: evento.body.id as string, qrId: qr.id as string };
}

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de ventas", () => {
  it("registra una venta y devuelve sus totales", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    const res = await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 20000,
        creadaEnDispositivo: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.total).toBe(15000);
    expect(res.body.cambio).toBe(5000);
  });

  it("reenviar el mismo uuid devuelve la misma venta y no duplica", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();
    const uuid = randomUUID();

    const cuerpo = {
      uuid,
      lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
      metodoPagoId: qrId,
      descuentoId: null,
      recibido: 0,
      creadaEnDispositivo: new Date().toISOString(),
    };

    const primera = await request(app).post(`/eventos/${eventoId}/ventas`).set(auth).send(cuerpo);
    const segunda = await request(app).post(`/eventos/${eventoId}/ventas`).set(auth).send(cuerpo);

    expect(segunda.body.id).toBe(primera.body.id);
    expect(await prisma.venta.count()).toBe(1);
  });

  it("el panel muestra bruto, meta y desglose por método", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 2 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    const res = await request(app).get(`/eventos/${eventoId}/totales`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.bruto).toBe(30000);
    expect(res.body.meta).toBe(1000000);
    expect(res.body.porMetodo).toEqual([{ metodo: "QR", total: 30000 }]);
  });

  it("el vendedor no ve comisiones ni neto en el panel", async () => {
    const { auth, eventoId, qrId } = await prepararFeria();

    await request(app)
      .post(`/eventos/${eventoId}/ventas`)
      .set(auth)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
        metodoPagoId: qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    // El usuario del registro es ADMIN, así que sí las ve.
    const comoAdmin = await request(app).get(`/eventos/${eventoId}/totales`).set(auth);
    expect(comoAdmin.body.comisiones).toBe(225);
    expect(comoAdmin.body.neto).toBe(14775);

    // Un vendedor del mismo emprendimiento no debe verlas.
    await prisma.usuario.create({
      data: {
        id: "vendedor-1",
        email: "v@dodoco.co",
        passwordHash: "no-se-usa",
        nombre: "Vendedor",
        rol: "VENDEDOR",
        emprendimientoId: (await prisma.emprendimiento.findFirstOrThrow()).id,
      },
    });

    const { firmarAccessToken } = await import("../src/services/token.service.js");
    const tokenVendedor = firmarAccessToken({
      id: "vendedor-1",
      email: "v@dodoco.co",
      nombre: "Vendedor",
      rol: "VENDEDOR",
      emprendimientoId: (await prisma.emprendimiento.findFirstOrThrow()).id,
    });

    const comoVendedor = await request(app)
      .get(`/eventos/${eventoId}/totales`)
      .set("Authorization", `Bearer ${tokenVendedor}`);

    expect(comoVendedor.body.bruto).toBe(15000);
    expect(comoVendedor.body).not.toHaveProperty("comisiones");
    expect(comoVendedor.body).not.toHaveProperty("neto");
  });

  it("no deja registrar una venta en el evento de otro emprendimiento", async () => {
    const primera = await prepararFeria();

    await request(app).post("/auth/registro").send({
      nombreEmprendimiento: "Medias Pao",
      nombreUsuario: "Beto",
      email: "b@medias.co",
      password: "clave-segura-123",
    });
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "b@medias.co", password: "clave-segura-123" });

    const res = await request(app)
      .post(`/eventos/${primera.eventoId}/ventas`)
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({
        uuid: randomUUID(),
        lineas: [{ nombre: "Robo", precioUnitario: 1, cantidad: 1 }],
        metodoPagoId: primera.qrId,
        descuentoId: null,
        recibido: 0,
        creadaEnDispositivo: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
    expect(await prisma.venta.count()).toBe(0);
  });
});
