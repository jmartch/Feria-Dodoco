import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Rol, UsuarioSeguro } from "../repositories/usuario.repository.js";

export type PayloadToken = {
  sub: string;
  emprendimientoId: string;
  rol: Rol;
};

/**
 * Falta a propósito un valor por defecto: si el secreto no está configurado, el
 * arranque debe fallar. Un literal de reserva escrito en el repositorio dejaría
 * firmar tokens con una clave pública, y cualquiera podría forjarse un `rol:
 * "ADMIN"` en el emprendimiento que quisiera.
 *
 * Se resuelve dentro de una función inmediatamente invocada (en vez de un
 * `const` + `if` a nivel de módulo) para que TypeScript en modo estricto
 * infiera el tipo de `ACCESS_SECRET` como `string` y no como `string |
 * undefined` dentro de las funciones que lo cierran más abajo.
 */
const ACCESS_SECRET: string = (() => {
  const secreto = process.env.JWT_ACCESS_SECRET;
  if (!secreto) {
    throw new Error(
      "Falta la variable de entorno JWT_ACCESS_SECRET. Copia .env.example a .env.",
    );
  }
  return secreto;
})();

const DURACION_ACCESS = "15m";
export const DIAS_REFRESH = 30;

export function firmarAccessToken(usuario: UsuarioSeguro): string {
  const payload: PayloadToken = {
    sub: usuario.id,
    emprendimientoId: usuario.emprendimientoId,
    rol: usuario.rol,
  };

  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: DURACION_ACCESS });
}

export function verificarAccessToken(token: string): PayloadToken {
  return jwt.verify(token, ACCESS_SECRET) as PayloadToken;
}

/** El refresh token es aleatorio; en la base solo se guarda su hash. */
export function generarRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("hex");
  return { token, hash: hashearRefresh(token) };
}

export function hashearRefresh(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
