import { ErrorDeNegocio } from "../errors.js";
import { emprendimientoRepository } from "../repositories/emprendimiento.repository.js";
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import {
  usuarioRepository,
  type UsuarioSeguro,
} from "../repositories/usuario.repository.js";
import { hashearPassword, verificarPassword } from "./password.service.js";
import {
  DIAS_REFRESH,
  firmarAccessToken,
  generarRefreshToken,
  hashearRefresh,
} from "./token.service.js";

export type DatosRegistro = {
  nombreEmprendimiento: string;
  email: string;
  password: string;
  nombreUsuario: string;
};

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSeguro;
};

async function abrirSesion(usuario: UsuarioSeguro): Promise<Sesion> {
  const { token, hash } = generarRefreshToken();
  const expiraEn = new Date(Date.now() + DIAS_REFRESH * 24 * 60 * 60 * 1000);

  await refreshTokenRepository.guardar(usuario.id, hash, expiraEn);

  return {
    accessToken: firmarAccessToken(usuario),
    refreshToken: token,
    usuario,
  };
}

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

  async login(email: string, password: string): Promise<Sesion> {
    const credencialesInvalidas = new ErrorDeNegocio(
      "CREDENCIALES_INVALIDAS",
      "Correo o contraseña incorrectos",
      401,
    );

    const usuario = await usuarioRepository.buscarPorEmailGlobal(
      email.trim().toLowerCase(),
    );
    if (!usuario) throw credencialesInvalidas;

    const coincide = await verificarPassword(usuario.passwordHash, password);
    if (!coincide) throw credencialesInvalidas;

    const { passwordHash: _descartado, ...seguro } = usuario;
    return abrirSesion(seguro);
  },

  async refrescar(refreshToken: string): Promise<Sesion> {
    const guardado = await refreshTokenRepository.buscarVigente(
      hashearRefresh(refreshToken),
    );

    if (!guardado) {
      throw new ErrorDeNegocio(
        "REFRESH_INVALIDO",
        "La sesión expiró, vuelve a entrar",
        401,
      );
    }

    await refreshTokenRepository.marcarUsado(guardado.id);

    const usuario = await usuarioRepository.buscarPorIdGlobal(
      guardado.usuarioId,
    );
    if (!usuario) {
      throw new ErrorDeNegocio(
        "REFRESH_INVALIDO",
        "La sesión expiró, vuelve a entrar",
        401,
      );
    }

    return abrirSesion(usuario);
  },
};
