const formateador = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Entero de pesos a texto en pesos colombianos, sin decimales. */
export function formatearPesos(valor: number): string {
  return formateador.format(valor);
}
