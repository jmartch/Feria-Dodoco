import { ErrorDeNegocio } from "../errors.js";
import { hashearPassword } from "./password.service.js";
import {
  usuarioRepository,
  type UsuarioSeguro,
} from "../repositories/usuario.repository.js";
import type { Scope } from "../repositories/scope.js";

export type DatosEmpleado = {
  nombre: string;
  email: string;
  password: string;
};

function tieneCodigo(error: unknown, codigo: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === codigo
  );
}

const emailYaRegistrado = new ErrorDeNegocio(
  "EMAIL_YA_REGISTRADO",
  "Ese correo ya tiene una cuenta",
  409,
);

export const usuarioService = {
  async listarEquipo(scope: Scope): Promise<UsuarioSeguro[]> {
    return usuarioRepository.listar(scope);
  },

  /** El dueño crea un vendedor dentro de su propio emprendimiento. */
  async crearEmpleado(scope: Scope, datos: DatosEmpleado): Promise<UsuarioSeguro> {
    const email = datos.email.trim().toLowerCase();

    if (await usuarioRepository.buscarPorEmailGlobal(email)) {
      throw emailYaRegistrado;
    }

    const passwordHash = await hashearPassword(datos.password);

    try {
      return await usuarioRepository.crear(scope, {
        email,
        passwordHash,
        nombre: datos.nombre.trim(),
        rol: "VENDEDOR",
      });
    } catch (error) {
      // Carrera: dos altas del mismo correo a la vez. El índice único lo atrapa.
      if (tieneCodigo(error, "P2002")) throw emailYaRegistrado;
      throw error;
    }
  },

  async eliminarEmpleado(scope: Scope, id: string): Promise<void> {
    const usuario = await usuarioRepository.buscarPorId(scope, id);
    if (!usuario) {
      throw new ErrorDeNegocio("USUARIO_NO_ENCONTRADO", "El empleado no existe", 404);
    }
    if (usuario.rol === "ADMIN") {
      throw new ErrorDeNegocio(
        "NO_SE_PUEDE_BORRAR_ADMIN",
        "No puedes eliminar a un administrador",
        409,
      );
    }

    try {
      await usuarioRepository.eliminar(scope, id);
    } catch (error) {
      // La venta guarda quién la registró con llave `Restrict`: si el vendedor
      // tiene ventas, no se borra para no dejar huérfano el registro contable.
      if (tieneCodigo(error, "P2003")) {
        throw new ErrorDeNegocio(
          "VENDEDOR_CON_VENTAS",
          "No se puede eliminar: este vendedor tiene ventas registradas",
          409,
        );
      }
      throw error;
    }
  },
};
