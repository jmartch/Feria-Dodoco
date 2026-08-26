import type { VentaGuardada } from "../api/tipos";
import { formatearPesos } from "./formato";

/** "02:18 p.m." — hora en 12h con cero inicial, sin segundos. */
function hora12(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "p.m." : "a.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Fecha local YYYY-MM-DD (no UTC, para que la noche no salte de día). */
function fechaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Mensaje del día para compartir: lista numerada de cada venta con su hora,
 * total y productos, y el total del día al final. Mismo molde de la
 * calculadora original.
 */
export function mensajeDelDia(nombreFeria: string, ventas: VentaGuardada[]): string {
  const fecha = fechaLocal(ventas[0]?.creadaEnDispositivo ?? new Date().toISOString());
  const lineas: string[] = [`🧸 Ventas ${nombreFeria} — ${fecha}`, ""];

  let total = 0;
  ventas.forEach((v, i) => {
    total += v.total;
    lineas.push(`${i + 1}. ${hora12(v.creadaEnDispositivo)} — ${formatearPesos(v.total)}`);
    for (const it of v.items ?? []) lineas.push(`   ${it.cantidad}× ${it.nombre}`);
  });

  lineas.push("", `Total del día (${ventas.length} ventas): ${formatearPesos(total)}`);
  return lineas.join("\n");
}
