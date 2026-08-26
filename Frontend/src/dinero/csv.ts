import type { VentaGuardada } from "../api/tipos";

/** "2:18:26 p.m." — hora con segundos, 12h, sin cero inicial en la hora. */
function horaCSV(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const ampm = h >= 12 ? "p.m." : "a.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`;
}

/** Puntos básicos a texto: 150 -> "1,5%", 0 -> "0%", 500 -> "5%". */
function comisionTexto(pct: number | undefined): string {
  if (!pct) return "0%";
  const p = pct / 100;
  return `${Number.isInteger(p) ? String(p) : String(p).replace(".", ",")}%`;
}

function productos(venta: VentaGuardada): string {
  return (venta.items ?? []).map((i) => `${i.cantidad}x ${i.nombre}`).join(", ");
}

const ENCABEZADO = [
  "Hora",
  "Productos",
  "Método",
  "Subtotal",
  "Descuento",
  "Total cobrado",
  "Comisión %",
  "Comisión $",
  "Neto recibido",
  "Recibido (efectivo)",
  "Cambio",
];

/** CSV de las ventas del día, con el mismo molde de la calculadora original. */
export function ventasACSV(ventas: VentaGuardada[]): string {
  let sumaTotal = 0;
  let sumaComision = 0;
  let sumaNeto = 0;

  const filas = ventas.map((v) => {
    sumaTotal += v.total;
    sumaComision += v.comisionValor ?? 0;
    sumaNeto += v.neto ?? v.total;
    return [
      horaCSV(v.creadaEnDispositivo),
      productos(v),
      v.metodoPagoNombre,
      String(v.subtotal ?? v.total),
      String(v.descuentoValor ?? 0),
      String(v.total),
      comisionTexto(v.comisionPct),
      String(v.comisionValor ?? 0),
      String(v.neto ?? v.total),
      String(v.recibido ?? ""),
      String(v.cambio ?? ""),
    ];
  });

  const totalDia = ["", "TOTAL DEL DÍA", "", "", "", String(sumaTotal), "", String(sumaComision), String(sumaNeto), "", ""];

  const escapar = (celda: string) => `"${celda.replace(/"/g, '""')}"`;
  return [ENCABEZADO, ...filas, totalDia].map((fila) => fila.map(escapar).join(",")).join("\r\n");
}

/** Dispara la descarga del CSV en el navegador. */
export function descargarCSV(nombreArchivo: string, contenido: string): void {
  // El BOM (﻿) hace que Excel abra bien los acentos.
  const blob = new Blob(["﻿", contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
