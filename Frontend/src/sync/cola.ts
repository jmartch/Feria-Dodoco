import { db } from "../db/base";
import type { ApiVentas } from "../api/ventas";

export type CuerpoVenta = {
  uuid: string;
  lineas: { nombre: string; precioUnitario: number; cantidad: number }[];
  metodoPagoId: string;
  descuentoId: string | null;
  recibido: number;
  creadaEnDispositivo: string;
};

export function crearCola(apiVentas: ApiVentas) {
  async function encolar(eventoId: string, cuerpo: CuerpoVenta): Promise<void> {
    await db.ventasPendientes.put({
      uuid: cuerpo.uuid,
      eventoId,
      cuerpo,
      estado: "pendiente",
      intentos: 0,
      creadaEn: new Date().toISOString(),
    });
  }

  async function contarPendientes(): Promise<number> {
    return db.ventasPendientes.where("estado").equals("pendiente").count();
  }

  async function sincronizar(): Promise<{ enviadas: number; pendientes: number }> {
    const pendientes = await db.ventasPendientes.where("estado").equals("pendiente").toArray();
    let enviadas = 0;

    for (const venta of pendientes) {
      try {
        await apiVentas.registrar(venta.eventoId, venta.cuerpo);
        // El backend es idempotente por uuid: si esta venta ya había entrado en
        // un envío cuya respuesta se perdió, reenviarla no duplica.
        await db.ventasPendientes.update(venta.uuid, { estado: "sincronizada" });
        enviadas += 1;
      } catch {
        await db.ventasPendientes.update(venta.uuid, { intentos: venta.intentos + 1 });
      }
    }

    return { enviadas, pendientes: await contarPendientes() };
  }

  return { encolar, sincronizar, contarPendientes };
}
