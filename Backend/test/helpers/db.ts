import { prisma } from "../../src/infra/prisma.js";

export async function limpiarBaseDeDatos(): Promise<void> {
  await prisma.ventaItem.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.descuento.deleteMany();
  await prisma.eventoItem.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.metodoPago.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.emprendimiento.deleteMany();
}
