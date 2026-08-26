import { formatearPesos } from "../src/dinero/formato";
import { calcularVenta } from "../src/dinero/calculo";

const sinPago = { descuentoPct: 0, comisionPct: 0, recibido: 0 };

describe("formato de pesos", () => {
  it("formatea enteros sin decimales y con separador de miles", () => {
    // Intl pone un espacio duro (U+00A0) tras el signo; se normaliza a espacio
    // normal para comparar el contenido, no el ancho del espacio.
    const espacioDuro = String.fromCharCode(160);
    const normal = (s: string) => s.split(espacioDuro).join(" ");
    expect(normal(formatearPesos(12000))).toBe("$ 12.000");
    expect(normal(formatearPesos(0))).toBe("$ 0");
    expect(normal(formatearPesos(1500000))).toBe("$ 1.500.000");
  });
});

describe("cálculo de una venta en el dispositivo", () => {
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

  it("aplica el descuento al subtotal y la comisión al total ya descontado", () => {
    const r = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 1000, // 10 % de 24000 = 2400 -> total 21600
      comisionPct: 500, // 5 % de 21600 = 1080
      recibido: 0,
    });
    expect(r.descuentoValor).toBe(2400);
    expect(r.total).toBe(21600);
    expect(r.comisionValor).toBe(1080);
    expect(r.neto).toBe(20520);
  });

  it("redondea la comisión a peso entero", () => {
    // 1,5 % de 12.345 son 185,175: debe quedar 185.
    const r = calcularVenta({
      lineas: [{ nombre: "Suelto", precioUnitario: 12345, cantidad: 1 }],
      descuentoPct: 0,
      comisionPct: 150,
      recibido: 0,
    });
    expect(r.comisionValor).toBe(185);
    expect(Number.isInteger(r.neto)).toBe(true);
  });

  it("el cambio nunca es negativo", () => {
    const sobra = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 50000,
    });
    expect(sobra.cambio).toBe(26000);
    const falta = calcularVenta({
      lineas: [{ nombre: "Pines", precioUnitario: 12000, cantidad: 2 }],
      descuentoPct: 0,
      comisionPct: 0,
      recibido: 10000,
    });
    expect(falta.cambio).toBe(0);
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
});
