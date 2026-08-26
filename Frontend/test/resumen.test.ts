import { expect, it } from "vitest";
import { resumenParaCompartir } from "../src/dinero/resumen";
import type { TotalesEvento } from "../src/api/tipos";

it("arma el texto del resumen con total y por método", () => {
  const totales: TotalesEvento = {
    cantidadVentas: 3,
    bruto: 300000,
    descuentos: 0,
    meta: 1000000,
    porMetodo: [
      { metodo: "Efectivo", total: 200000 },
      { metodo: "QR", total: 100000 },
    ],
  };

  const texto = resumenParaCompartir("Feria de abril", totales);

  expect(texto).toContain("Feria de abril");
  expect(texto).toContain("Ventas: 3");
  expect(texto).toMatch(/Total vendido: \$\s?300\.000/);
  expect(texto).toContain("Efectivo");
  expect(texto).toContain("QR");
});
