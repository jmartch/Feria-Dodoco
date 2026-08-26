import type { Cliente } from "./cliente";
import type { Sesion, Usuario } from "./tipos";

export type DatosRegistro = {
  nombreEmprendimiento: string;
  nombreUsuario: string;
  email: string;
  password: string;
};

export function crearApiAuth(cliente: Cliente) {
  return {
    registrar(datos: DatosRegistro) {
      return cliente.pedir<{ usuario: Usuario }>("/auth/registro", {
        method: "POST",
        body: JSON.stringify(datos),
        autenticar: false,
      });
    },
    login(email: string, password: string) {
      return cliente.pedir<Sesion>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        autenticar: false,
      });
    },
  };
}
