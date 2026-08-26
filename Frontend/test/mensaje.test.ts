import { expect, it } from "vitest";
import { mensajeDelDia } from "../src/dinero/mensaje";
import type { VentaGuardada } from "../src/api/tipos";

function venta(iso: string, total: number, items: VentaGuardada["items"]): VentaGuardada {
  return { id: "v", uuid: "u", total, metodoPagoNombre: "Efectivo", creadaEnDispositivo: iso, items };
}

it("arma la lista numerada con hora, total y productos, y el total del día", () => {
  const ventas = [
    venta("2026-08-16T19:18:00.000Z", 18000, [{ nombre: "Stickers grandes", cantidad: 1, precioUnitario: 18000, subtotal: 18000 }]),
    venta("2026-08-16T19:35:00.000Z", 24000, [{ nombre: "Pines", cantidad: 2, precioUnitario: 12000, subtotal: 24000 }]),
  ];

  const texto = mensajeDelDia("Dodoco", ventas);
  const lineas = texto.split("\n");

  expect(lineas[0]).toContain("🧸 Ventas Dodoco — 2026-08-16");
  // Primera venta numerada, con hora en 12h y sus productos indentados.
  expect(texto).toMatch(/1\. \d{2}:\d{2} (a\.m\.|p\.m\.) — \$/);
  expect(texto).toContain("1× Stickers grandes");
  expect(texto).toContain("2× Pines");
  // Total del día con el conteo y la suma.
  expect(texto).toMatch(/Total del día \(2 ventas\): \$\s?42\.000/);
});
