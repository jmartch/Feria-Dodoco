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

  async buscarVigente(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, usadoEn: null, expiraEn: { gt: new Date() } },
    });
  },

  async marcarUsado(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
  },
};
