import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Rol, UsuarioSeguro } from "../repositories/usuario.repository.js";

export type PayloadToken = {
  sub: string;
  emprendimientoId: string;
  rol: Rol;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "secreto-de-desarrollo";
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
