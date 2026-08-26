import type { Cliente } from "./cliente";
import type { Gasto } from "./tipos";

export function crearApiGastos(cliente: Cliente) {
  return {
    listar: (eventoId: string) =>
      cliente.pedir<{ gastos: Gasto[]; total: number }>(`/eventos/${eventoId}/gastos`),
    crear: (eventoId: string, cuerpo: { concepto: string; categoria: string; monto: number }) =>
      cliente.pedir<Gasto>(`/eventos/${eventoId}/gastos`, { method: "POST", body: JSON.stringify(cuerpo) }),
    eliminar: (eventoId: string, gastoId: string) =>
      cliente.pedir<void>(`/eventos/${eventoId}/gastos/${gastoId}`, { method: "DELETE" }),
  };
}

export type ApiGastos = ReturnType<typeof crearApiGastos>;
