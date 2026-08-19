import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";

export const refreshTokenRepository = {
  async guardar(
    usuarioId: string,
    tokenHash: string,
    expiraEn: Date,
  ): Promise<void> {
    await prisma.refreshToken.create({
      data: { id: randomUUID(), usuarioId, tokenHash, expiraEn },
    });
  },

  async buscarVigente(
    tokenHash: string,
  ): Promise<{ id: string; usuarioId: string } | null> {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, usadoEn: null, expiraEn: { gt: new Date() } },
      select: { id: true, usuarioId: true },
    });
  },

  /**
   * Marca el token como usado solo si seguía sin usar. Devuelve `true` si esta
   * llamada fue la que lo consumió.
   *
   * Es una comparación y escritura en una sola operación a propósito: con un
   * `update` incondicional, dos refrescos simultáneos con el mismo token
   * obtendrían ambos una sesión nueva, que es exactamente lo que la rotación
   * debe impedir.
   */
  async marcarUsado(id: string): Promise<boolean> {
    const { count } = await prisma.refreshToken.updateMany({
      where: { id, usadoEn: null },
      data: { usadoEn: new Date() },
    });

    return count === 1;
  },
};
