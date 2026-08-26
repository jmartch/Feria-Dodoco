import { expect, it } from "vitest";
import { ventasACSV } from "../src/dinero/csv";
import type { VentaGuardada } from "../src/api/tipos";

it("arma el CSV con encabezado, la hora de la venta y el total", () => {
  const ventas: VentaGuardada[] = [
    {
      id: "v1",
      uuid: "u1",
      total: 24000,
      metodoPagoNombre: "Efectivo",
      creadaEnDispositivo: "2026-08-26T15:30:00.000Z",
      subtotal: 24000,
      descuentoValor: 0,
      recibido: 30000,
      cambio: 6000,
    },
  ];

  const csv = ventasACSV(ventas);
  const lineas = csv.split("\r\n");

  expect(lineas[0]).toBe('"Fecha","Hora","Subtotal","Descuento","Total","Metodo","Recibido","Cambio"');
  // La fila lleva el total, el método y una hora (HH:MM).
  expect(lineas[1]).toContain('"24000"');
  expect(lineas[1]).toContain('"Efectivo"');
  expect(lineas[1]).toMatch(/"\d{1,2}:\d{2}/);
});

it("una venta sin campos opcionales no rompe el CSV", () => {
  const csv = ventasACSV([
    { id: "v2", uuid: "u2", total: 5000, metodoPagoNombre: "QR", creadaEnDispositivo: "2026-08-26T10:00:00.000Z" },
  ]);
  expect(csv.split("\r\n")).toHaveLength(2);
  expect(csv).toContain('"5000"');
});
