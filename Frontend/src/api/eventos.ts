import type { Cliente } from "./cliente";
import type { Descuento, Evento, EventoItem } from "./tipos";

export function crearApiEventos(cliente: Cliente) {
  return {
    listar: () => cliente.pedir<Evento[]>("/eventos"),
    crear: (datos: { nombre: string; fechaInicio: string; fechaFin: string | null; meta: number }) =>
      cliente.pedir<Evento>("/eventos", { method: "POST", body: JSON.stringify(datos) }),
    buscar: (id: string) => cliente.pedir<Evento>(`/eventos/${id}`),
    cambiarCandado: (id: string, bloqueado: boolean) =>
      cliente.pedir<Evento>(`/eventos/${id}/candado`, { method: "PATCH", body: JSON.stringify({ bloqueado }) }),
    listarLineas: (id: string) => cliente.pedir<EventoItem[]>(`/eventos/${id}/lineas`),
    crearLinea: (id: string, cuerpo: { categoriaId: string } | { nombre: string; precio: number }) =>
      cliente.pedir<EventoItem>(`/eventos/${id}/lineas`, { method: "POST", body: JSON.stringify(cuerpo) }),
    eliminarLinea: (id: string, lineaId: string) =>
      cliente.pedir<void>(`/eventos/${id}/lineas/${lineaId}`, { method: "DELETE" }),
    listarDescuentos: (id: string) => cliente.pedir<Descuento[]>(`/eventos/${id}/descuentos`),
    crearDescuento: (id: string, cuerpo: { nombre: string; porcentaje: number; activo: boolean }) =>
      cliente.pedir<Descuento>(`/eventos/${id}/descuentos`, { method: "POST", body: JSON.stringify(cuerpo) }),
  };
}

export type ApiEventos = ReturnType<typeof crearApiEventos>;
