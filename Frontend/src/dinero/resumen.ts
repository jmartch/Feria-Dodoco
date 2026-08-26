import type { TotalesEvento } from "../api/tipos";
import { formatearPesos } from "./formato";

/** Texto del resumen del día para compartir por WhatsApp, correo, etc. */
export function resumenParaCompartir(nombreFeria: string, totales: TotalesEvento): string {
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const lineas = [
    `Resumen de ventas — ${nombreFeria}`,
    fecha,
    "",
    `Ventas: ${totales.cantidadVentas}`,
    `Total vendido: ${formatearPesos(totales.bruto)}`,
  ];
  if (totales.porMetodo.length > 0) {
    lineas.push("", "Por método de pago:");
    for (const m of totales.porMetodo) lineas.push(`- ${m.metodo}: ${formatearPesos(m.total)}`);
  }
  return lineas.join("\n");
}
