import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { eventoRepository } from "../src/repositories/evento.repository.js";
import { ventaRepository } from "../src/repositories/venta.repository.js";
import { ventaService } from "../src/services/venta.service.js";
import { metodoPagoService } from "../src/services/metodoPago.service.js";

const A = "emp-a";
const scopeA = { emprendimientoId: A };
let eventoId = "";
let qrId = "";
let efectivoId = "";

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.create({ data: { id: A, nombre: "Dodoco" } });
  await prisma.usuario.create({
    data: {
      id: "u1",
      email: "a@dodoco.co",
      passwordHash: "h",
      nombre: "Ana",
      rol: "ADMIN",
      emprendimientoId: A,
    },
  });

  const evento = await eventoRepository.crear(scopeA, {
    nombre: "Feria",
    fechaInicio: new Date(),
    fechaFin: null,
    meta: 1000000,
  });
  eventoId = evento.id;

  const metodos = await metodoPagoService.aplicarPreajusteBold(scopeA);
  efectivoId = metodos.find((m) => m.nombre === "Efectivo")!.id;
  qrId = metodos.find((m) => m.nombre === "QR")!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function entrada(uuid: string, metodoPagoId: string) {
  return {
    uuid,
    eventoId,
    lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
    descuentoId: null,
    metodoPagoId,
    recibido: 0,
    creadaEnDispositivo: new Date(),
  };
}

describe("registro de ventas", () => {
  it("guarda la venta con sus totales y su detalle", async () => {
    const venta = await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));

    expect(venta.total).toBe(15000);
    expect(venta.comisionValor).toBe(225);
    expect(venta.neto).toBe(14775);
    expect(venta.metodoPagoNombre).toBe("QR");

    const items = await prisma.ventaItem.findMany({ where: { ventaId: venta.id } });
    expect(items).toHaveLength(1);
    expect(items[0].subtotal).toBe(15000);
  });

  it("reenviar el mismo uuid no duplica la venta", async () => {
    const uuid = randomUUID();

    const primera = await ventaService.registrar(scopeA, "u1", entrada(uuid, qrId));
    const segunda = await ventaService.registrar(scopeA, "u1", entrada(uuid, qrId));

    expect(segunda.id).toBe(primera.id);
    expect(await prisma.venta.count()).toBe(1);
    expect(await prisma.ventaItem.count()).toBe(1);
  });

  it("dos envíos simultáneos del mismo uuid dejan una sola venta", async () => {
    const uuid = randomUUID();

    await Promise.allSettled([
      ventaService.registrar(scopeA, "u1", entrada(uuid, qrId)),
      ventaService.registrar(scopeA, "u1", entrada(uuid, qrId)),
    ]);

    expect(await prisma.venta.count()).toBe(1);
  });

  it("guarda la comisión del momento aunque después cambie la del método", async () => {
    const venta = await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));

    await prisma.metodoPago.update({ where: { id: qrId }, data: { comisionPct: 9999 } });

    const guardada = await ventaRepository.buscarPorUuid(scopeA, venta.uuid);
    expect(guardada?.comisionPct).toBe(150);
    expect(guardada?.neto).toBe(14775);
  });

  it("rechaza vender en un evento de otro emprendimiento", async () => {
    await expect(
      ventaService.registrar({ emprendimientoId: "otro" }, "u1", entrada(randomUUID(), qrId)),
    ).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });
  });

  it("los totales del evento separan bruto, comisiones y neto por método", async () => {
    await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), qrId));
    await ventaService.registrar(scopeA, "u1", entrada(randomUUID(), efectivoId));

    const totales = await ventaRepository.totalesDelEvento(scopeA, eventoId);

    expect(totales.cantidadVentas).toBe(2);
    expect(totales.bruto).toBe(30000);
    expect(totales.comisiones).toBe(225);
    expect(totales.neto).toBe(29775);
    expect(totales.porMetodo).toEqual(
      expect.arrayContaining([
        { metodo: "QR", total: 15000 },
        { metodo: "Efectivo", total: 15000 },
      ]),
    );
  });
});
