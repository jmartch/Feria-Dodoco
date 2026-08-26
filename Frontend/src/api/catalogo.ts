import type { Cliente } from "./cliente";
import type { Categoria, MetodoPago } from "./tipos";

export function crearApiCatalogo(cliente: Cliente) {
  return {
    listarCategorias: () => cliente.pedir<Categoria[]>("/catalogo/categorias"),
    crearCategoria: (cuerpo: { nombre: string; precio: number }) =>
      cliente.pedir<Categoria>("/catalogo/categorias", { method: "POST", body: JSON.stringify(cuerpo) }),
    actualizarCategoria: (id: string, cuerpo: { nombre: string; precio: number }) =>
      cliente.pedir<Categoria>(`/catalogo/categorias/${id}`, { method: "PUT", body: JSON.stringify(cuerpo) }),
    eliminarCategoria: (id: string) =>
      cliente.pedir<void>(`/catalogo/categorias/${id}`, { method: "DELETE" }),
    listarMetodos: () => cliente.pedir<MetodoPago[]>("/catalogo/metodos-pago"),
    crearMetodo: (cuerpo: { nombre: string; comisionPct: number; activo: boolean }) =>
      cliente.pedir<MetodoPago>("/catalogo/metodos-pago", { method: "POST", body: JSON.stringify(cuerpo) }),
    preajusteBold: () =>
      cliente.pedir<MetodoPago[]>("/catalogo/metodos-pago/preajuste-bold", { method: "POST", body: JSON.stringify({}) }),
  };
}

export type ApiCatalogo = ReturnType<typeof crearApiCatalogo>;
