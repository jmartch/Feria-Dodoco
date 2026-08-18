import { ErrorDeNegocio } from "../errors.js";
import { emprendimientoRepository } from "../repositories/emprendimiento.repository.js";
import {
  usuarioRepository,
  type UsuarioSeguro,
} from "../repositories/usuario.repository.js";
import { hashearPassword } from "./password.service.js";

export type DatosRegistro = {
  nombreEmprendimiento: string;
  email: string;
  password: string;
  nombreUsuario: string;
};

export const authService = {
  async registrar(datos: DatosRegistro): Promise<UsuarioSeguro> {
    const email = datos.email.trim().toLowerCase();
    const existente = await usuarioRepository.buscarPorEmailGlobal(email);

    if (existente) {
      throw new ErrorDeNegocio(
        "EMAIL_YA_REGISTRADO",
        "Ese correo ya tiene una cuenta",
        409,
      );
    }

    const passwordHash = await hashearPassword(datos.password);

    const { usuario } = await emprendimientoRepository.crearConAdmin({
      nombreEmprendimiento: datos.nombreEmprendimiento.trim(),
      email,
      passwordHash,
      nombreUsuario: datos.nombreUsuario.trim(),
    });

    return usuario;
  },
};
