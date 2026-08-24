import { describe, it, expect } from "vitest";
import { calcularVenta } from "../src/services/calculo.service.js";

const sinPago = { descuentoPct: 0, comisionPct: 0, recibido: 0 };

describe("cálculo de una venta", () => {
  it("suma los subtotales de cada línea", () => {
    const r = calcularVenta({
      lineas: [
        { nombre: "Pines", precioUnitario: 12000, cantidad: 2 },
        { nombre: "Diademas", precioUnitario: 15000, cantidad: 1 },
      ],
      ...sinPago,
    });

    expect(r.items[0].subtotal).toBe(24000);
    expect(r.subtotal).toBe(39000);
    expect(r.total).toBe(39000);
  });

  it("aplica el descuento sobre el subtotal", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 %
      comisionPct: 0,
      recibido: 0,
    });

    expect(r.descuentoValor).toBe(2400);
    expect(r.total).toBe(21600);
  });

  it("calcula la comisión sobre el total ya descontado, no sobre el subtotal", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 % -> total 21600
      comisionPct: 500, // 5 % de 21600 = 1080
      recibido: 0,
    });

    expect(r.comisionValor).toBe(1080);
    expect(r.neto).toBe(20520);
  });

  it("reproduce las cifras reales de la feria: QR al 1,5 % sobre 15.000", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Diademas", precioUnitario: 15000, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });

    expect(r.total).toBe(15000);
    expect(r.comisionValor).toBe(225);
    expect(r.neto).toBe(14775);
  });

  it("redondea a peso entero, nunca deja decimales", () => {
    // 1,5 % de 12.345 son 185,175: debe quedar 185, no 185,175.
    const r = calcularVenta({
      lineas: [{ nombre: "Suelto", precioUnitario: 12345, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });

    expect(r.comisionValor).toBe(185);
    expect(Number.isInteger(r.comisionValor)).toBe(true);
    expect(Number.isInteger(r.neto)).toBe(true);
  });

  it("el cambio es lo recibido menos el total, y nunca negativo", () => {
    const conSobra = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 50000,
    });
    expect(conSobra.cambio).toBe(26000);

    const insuficiente = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 10000,
    });
    expect(insuficiente.cambio).toBe(0);
  });

  it("ignora las líneas con cantidad cero o negativa", () => {
    const r = calcularVenta({
      lineas: [
        { nombre: "Pines", precioUnitario: 12000, cantidad: 0 },
        { nombre: "Stickers", precioUnitario: 5000, cantidad: -3 },
        { nombre: "Diademas", precioUnitario: 15000, cantidad: 1 },
      ],
      ...sinPago,
    });

    expect(r.items).toHaveLength(1);
    expect(r.subtotal).toBe(15000);
  });

  it("una venta sin líneas vale cero en todo", () => {
    const r = calcularVenta({ lineas: [], descuentoPct: 1000, comisionPct: 500, recibido: 0 });

    expect(r.subtotal).toBe(0);
    expect(r.descuentoValor).toBe(0);
    expect(r.total).toBe(0);
    expect(r.comisionValor).toBe(0);
    expect(r.neto).toBe(0);
  });
});
