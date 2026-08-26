import { expect, it } from "vitest";
import { ventasACSV } from "../src/dinero/csv";
import type { VentaGuardada } from "../src/api/tipos";

function venta(over: Partial<VentaGuardada>): VentaGuardada {
  return {
    id: "v",
    uuid: "u",
    total: 24000,
    metodoPagoNombre: "Efectivo",
    creadaEnDispositivo: "2026-08-16T19:18:26.000Z",
    subtotal: 24000,
    descuentoValor: 0,
    comisionPct: 0,
    comisionValor: 0,
    neto: 24000,
    recibido: 30000,
    cambio: 6000,
    items: [{ nombre: "Pines", cantidad: 2, precioUnitario: 12000, subtotal: 24000 }],
    ...over,
  };
}

it("usa el molde original: encabezado, productos, comisión y fila total", () => {
  const csv = ventasACSV([
    venta({}),
    venta({ metodoPagoNombre: "QR", comisionPct: 150, comisionValor: 360, neto: 23640, recibido: 0, cambio: 0 }),
  ]);
  const lineas = csv.split("\r\n");

  expect(lineas[0]).toBe(
    '"Hora","Productos","Método","Subtotal","Descuento","Total cobrado","Comisión %","Comisión $","Neto recibido","Recibido (efectivo)","Cambio"',
  );
  // Productos como "Nx Nombre".
  expect(lineas[1]).toContain('"2x Pines"');
  // Comisión en porcentaje con coma decimal.
  expect(lineas[2]).toContain('"1,5%"');
  expect(lineas[2]).toContain('"360"');
  // Última fila: TOTAL DEL DÍA con la suma de totales, comisiones y neto.
  const total = lineas[lineas.length - 1];
  expect(total).toContain('"TOTAL DEL DÍA"');
  expect(total).toContain('"48000"'); // 24000 + 24000
  expect(total).toContain('"360"'); // comisiones
});
