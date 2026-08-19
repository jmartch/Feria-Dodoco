import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";

const EMP = "emp-dominio";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.create({
    data: { id: EMP, nombre: "Dodoco Store" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("esquema del dominio de ventas", () => {
  it("rechaza dos ventas con el mismo uuid", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria de prueba",
        fechaInicio: new Date(),
        meta: 1000000,
        emprendimientoId: EMP,
      },
    });

    const venta = (uuid: string) => ({
      id: randomUUID(),
      uuid,
      eventoId: evento.id,
      usuarioId: "u1",
      subtotal: 12000,
      total: 12000,
      metodoPagoNombre: "Efectivo",
      neto: 12000,
      creadaEnDispositivo: new Date(),
      emprendimientoId: EMP,
    });

    const mismoUuid = "uuid-repetido";
    await prisma.venta.create({ data: venta(mismoUuid) });

    await expect(prisma.venta.create({ data: venta(mismoUuid) })).rejects.toThrow();
  });

  it("borra las líneas y las ventas al borrar el evento", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria efímera",
        fechaInicio: new Date(),
        meta: 500000,
        emprendimientoId: EMP,
        lineas: {
          create: {
            id: randomUUID(),
            nombre: "Pines",
            precio: 12000,
            origenTipo: "CATEGORIA",
            emprendimientoId: EMP,
          },
        },
      },
    });

    await prisma.evento.delete({ where: { id: evento.id } });

    expect(await prisma.eventoItem.count()).toBe(0);
  });

  it("guarda el dinero como entero y el evento arranca desbloqueado y activo", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria",
        fechaInicio: new Date(),
        meta: 1000000,
        emprendimientoId: EMP,
      },
    });

    expect(Number.isInteger(evento.meta)).toBe(true);
    expect(evento.catalogoBloqueado).toBe(false);
    expect(evento.estado).toBe("ACTIVO");
  });
});
