import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";

const EMP = "emp-dominio";
const USUARIO = "usuario-dominio";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.create({
    data: {
      id: EMP,
      nombre: "Dodoco Store",
      usuarios: {
        create: {
          id: USUARIO,
          email: "admin@dodoco.co",
          passwordHash: "no-se-usa-en-esta-prueba",
          nombre: "Ana",
          rol: "ADMIN",
        },
      },
    },
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
      usuarioId: USUARIO,
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

  // Comprueba las TRES cascadas del evento, no solo una: si solo se creara una
  // línea, quitar el `onDelete: Cascade` de ventas o descuentos dejaría esta
  // prueba en verde y la garantía sería falsa.
  it("borra líneas, descuentos y ventas al borrar el evento", async () => {
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
        descuentos: {
          create: {
            id: randomUUID(),
            nombre: "Donación al acopio",
            porcentaje: 1000,
            emprendimientoId: EMP,
          },
        },
      },
    });

    const venta = await prisma.venta.create({
      data: {
        id: randomUUID(),
        uuid: randomUUID(),
        eventoId: evento.id,
        usuarioId: USUARIO,
        subtotal: 12000,
        total: 12000,
        metodoPagoNombre: "Efectivo",
        neto: 12000,
        creadaEnDispositivo: new Date(),
        emprendimientoId: EMP,
        items: {
          create: {
            id: randomUUID(),
            nombre: "Pines",
            precioUnitario: 12000,
            cantidad: 1,
            subtotal: 12000,
            emprendimientoId: EMP,
          },
        },
      },
    });

    expect(venta.id).toBeTruthy();

    await prisma.evento.delete({ where: { id: evento.id } });

    expect(await prisma.eventoItem.count()).toBe(0);
    expect(await prisma.descuento.count()).toBe(0);
    expect(await prisma.venta.count()).toBe(0);
    // La venta arrastra sus items: si no, quedarían líneas de venta sin venta.
    expect(await prisma.ventaItem.count()).toBe(0);
  });

  it("no deja borrar a un vendedor que tiene ventas registradas", async () => {
    const evento = await prisma.evento.create({
      data: {
        id: randomUUID(),
        nombre: "Feria",
        fechaInicio: new Date(),
        meta: 500000,
        emprendimientoId: EMP,
      },
    });

    await prisma.venta.create({
      data: {
        id: randomUUID(),
        uuid: randomUUID(),
        eventoId: evento.id,
        usuarioId: USUARIO,
        subtotal: 12000,
        total: 12000,
        metodoPagoNombre: "Efectivo",
        neto: 12000,
        creadaEnDispositivo: new Date(),
        emprendimientoId: EMP,
      },
    });

    // Sin la llave foránea, este borrado pasaría y dejaría la venta apuntando a
    // un usuario inexistente, en silencio.
    await expect(
      prisma.usuario.delete({ where: { id: USUARIO } }),
    ).rejects.toThrow();
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
