import argon2 from "argon2";

export async function hashearPassword(plana: string): Promise<string> {
  return argon2.hash(plana, { type: argon2.argon2id });
}

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
