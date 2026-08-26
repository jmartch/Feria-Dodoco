import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../src/db/base";
import { crearCola, type CuerpoVenta } from "../src/sync/cola";
import type { VentaGuardada } from "../src/api/tipos";

function cuerpo(uuid: string): CuerpoVenta {
  return {
    uuid,
    lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 1 }],
    metodoPagoId: "m1",
    descuentoId: null,
    recibido: 12000,
    creadaEnDispositivo: new Date().toISOString(),
  };
}

beforeEach(async () => {
  await db.ventasPendientes.clear();
});

it("encolar guarda la venta como pendiente", async () => {
  const cola = crearCola({ registrar: vi.fn(), totales: vi.fn(), listar: vi.fn() });
  await cola.encolar("e1", cuerpo("u1"));
  expect(await cola.contarPendientes()).toBe(1);
});

it("sincronizar envia las pendientes y las marca sincronizadas", async () => {
  const registrar = vi.fn(async (): Promise<VentaGuardada> => ({
    id: "v1",
    uuid: "u1",
    total: 12000,
    metodoPagoNombre: "Efectivo",
    creadaEnDispositivo: new Date().toISOString(),
  }));
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  const res = await cola.sincronizar();

  expect(registrar).toHaveBeenCalledWith("e1", expect.objectContaining({ uuid: "u1" }));
  expect(res).toEqual({ enviadas: 1, pendientes: 0 });
  expect(await cola.contarPendientes()).toBe(0);
});

it("una venta que falla al enviar queda pendiente y suma un intento", async () => {
  const registrar = vi.fn(async () => {
    throw new Error("sin red");
  });
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  const res = await cola.sincronizar();

  expect(res).toEqual({ enviadas: 0, pendientes: 1 });
  const guardada = await db.ventasPendientes.get("u1");
  expect(guardada?.estado).toBe("pendiente");
  expect(guardada?.intentos).toBe(1);
});

it("no reenvia una venta ya sincronizada", async () => {
  const registrar = vi.fn(async (): Promise<VentaGuardada> => ({
    id: "v1", uuid: "u1", total: 12000, metodoPagoNombre: "Efectivo", creadaEnDispositivo: "x",
  }));
  const cola = crearCola({ registrar, totales: vi.fn(), listar: vi.fn() });

  await cola.encolar("e1", cuerpo("u1"));
  await cola.sincronizar();
  await cola.sincronizar();

  expect(registrar).toHaveBeenCalledTimes(1);
});
