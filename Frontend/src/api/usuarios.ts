import type { Cliente } from "./cliente";
import type { Usuario } from "./tipos";

export function crearApiUsuarios(cliente: Cliente) {
  return {
    listar: () => cliente.pedir<Usuario[]>("/usuarios"),
    crear: (cuerpo: { nombre: string; email: string; password: string }) =>
      cliente.pedir<Usuario>("/usuarios", { method: "POST", body: JSON.stringify(cuerpo) }),
    eliminar: (id: string) => cliente.pedir<void>(`/usuarios/${id}`, { method: "DELETE" }),
  };
}

export type ApiUsuarios = ReturnType<typeof crearApiUsuarios>;
