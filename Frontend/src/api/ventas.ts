import type { Cliente } from "./cliente";
import type { TotalesEvento, VentaGuardada } from "./tipos";

export function crearApiVentas(cliente: Cliente) {
  return {
    registrar(eventoId: string, cuerpo: unknown) {
      return cliente.pedir<VentaGuardada>(`/eventos/${eventoId}/ventas`, {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
    },
    listar(eventoId: string) {
      return cliente.pedir<VentaGuardada[]>(`/eventos/${eventoId}/ventas`);
    },
    eliminar(eventoId: string, ventaId: string) {
      return cliente.pedir<void>(`/eventos/${eventoId}/ventas/${ventaId}`, { method: "DELETE" });
    },
    totales(eventoId: string) {
      return cliente.pedir<TotalesEvento>(`/eventos/${eventoId}/totales`);
    },
  };
}

export type ApiVentas = ReturnType<typeof crearApiVentas>;
