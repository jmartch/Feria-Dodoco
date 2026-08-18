import { prisma } from "../../src/infra/prisma.js";

export async function limpiarBaseDeDatos(): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.emprendimiento.deleteMany();
}
