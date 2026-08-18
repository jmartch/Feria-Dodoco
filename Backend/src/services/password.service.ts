import { randomUUID } from "node:crypto";
import argon2 from "argon2";

export async function hashearPassword(plana: string): Promise<string> {
  return argon2.hash(plana, { type: argon2.argon2id });
}

/**
 * Hash señuelo, calculado una sola vez al arrancar. El login lo usa cuando el
 * correo no existe, para que verificar tarde lo mismo que con un correo real
 * y no delate por temporización qué correos están registrados.
 */
export const HASH_SENUELO = await hashearPassword(randomUUID());

export async function verificarPassword(
  hash: string,
  plana: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plana);
  } catch {
    return false;
  }
}
