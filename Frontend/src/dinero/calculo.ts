export type LineaVendida = {
  nombre: string;
  precioUnitario: number;
  cantidad: number;
};

export type ItemCalculado = LineaVendida & { subtotal: number };

export type EntradaCalculo = {
  lineas: LineaVendida[];
  /** Puntos básicos: 1000 son 10 %. */
  descuentoPct: number;
  /** Puntos básicos: 150 son 1,5 %. */
  comisionPct: number;
  recibido: number;
};

export type ResultadoCalculo = {
  items: ItemCalculado[];
  subtotal: number;
  descuentoValor: number;
  total: number;
  comisionValor: number;
  neto: number;
  cambio: number;
};

const BASE_PORCENTAJE = 10_000;

/**
 * La misma aritmética del backend, aquí para poder cobrar sin conexión. El
 * orden no es intercambiable: el descuento se aplica al subtotal y la comisión
 * al total ya descontado. Todo en enteros de pesos.
 */
export function calcularVenta(entrada: EntradaCalculo): ResultadoCalculo {
  const items = entrada.lineas
    .filter((linea) => linea.cantidad > 0)
    .map((linea) => ({ ...linea, subtotal: linea.precioUnitario * linea.cantidad }));

  const subtotal = items.reduce((suma, item) => suma + item.subtotal, 0);
  const descuentoValor = Math.round((subtotal * entrada.descuentoPct) / BASE_PORCENTAJE);
  const total = subtotal - descuentoValor;
  const comisionValor = Math.round((total * entrada.comisionPct) / BASE_PORCENTAJE);
  const neto = total - comisionValor;
  const cambio = Math.max(0, entrada.recibido - total);

  return { items, subtotal, descuentoValor, total, comisionValor, neto, cambio };
}
