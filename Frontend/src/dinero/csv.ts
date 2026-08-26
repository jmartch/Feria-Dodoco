import type { VentaGuardada } from "../api/tipos";

function fechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return { fecha, hora };
}

/** Arma el CSV de las ventas del evento. Incluye la hora de cada venta. */
export function ventasACSV(ventas: VentaGuardada[]): string {
  const encabezado = ["Fecha", "Hora", "Subtotal", "Descuento", "Total", "Metodo", "Recibido", "Cambio"];
  const filas = ventas.map((v) => {
    const { fecha, hora } = fechaHora(v.creadaEnDispositivo);
    return [
      fecha,
      hora,
      String(v.subtotal ?? ""),
      String(v.descuentoValor ?? ""),
      String(v.total),
      v.metodoPagoNombre,
      String(v.recibido ?? ""),
      String(v.cambio ?? ""),
    ];
  });

  const escapar = (celda: string) => `"${celda.replace(/"/g, '""')}"`;
  return [encabezado, ...filas].map((fila) => fila.map(escapar).join(",")).join("\r\n");
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
