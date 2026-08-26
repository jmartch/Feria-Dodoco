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

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("rutas de catálogo", () => {
  it("exige sesión", async () => {
    const res = await request(app).get("/catalogo/categorias");

    expect(res.status).toBe(401);
  });

  it("crea y lista categorías del emprendimiento propio", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const creada = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000 });

    expect(creada.status).toBe(201);
    expect(creada.body.precio).toBe(12000);

    const lista = await request(app)
      .get("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`);

    expect(lista.body).toHaveLength(1);
  });

  it("un emprendimiento no ve ni puede tocar las categorías de otro", async () => {
    const tokenA = await registrarYEntrar("Dodoco", "a@dodoco.co");
    const tokenB = await registrarYEntrar("Medias Pao", "b@medias.co");

    const deB = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ nombre: "Medias", precio: 15000 });

    const listaDeA = await request(app)
      .get("/catalogo/categorias")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(listaDeA.body).toHaveLength(0);

    const intento = await request(app)
      .put(`/catalogo/categorias/${deB.body.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ nombre: "Robada", precio: 1 });
    expect(intento.status).toBe(404);

    const sigueIgual = await prisma.categoria.findUnique({ where: { id: deB.body.id } });
    expect(sigueIgual?.nombre).toBe("Medias");
  });

  it("rechaza un precio que no sea entero positivo", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/catalogo/categorias")
      .set("Authorization", `Bearer ${token}`)
      .send({ nombre: "Pines", precio: 12000.5 });

    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe("DATOS_INVALIDOS");
  });

  it("el preajuste de Bold deja los tres métodos configurados", async () => {
    const token = await registrarYEntrar("Dodoco", "a@dodoco.co");

    const res = await request(app)
      .post("/catalogo/metodos-pago/preajuste-bold")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.map((m: { nombre: string }) => m.nombre)).toEqual([
      "Efectivo",
      "QR",
      "Datáfono",
    ]);
  });
});
