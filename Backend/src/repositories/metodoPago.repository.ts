import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type MetodoPago = {
  id: string;
  nombre: string;
  comisionPct: number;
  activo: boolean;
};

export type NuevoMetodoPago = {
  nombre: string;
  comisionPct: number;
  activo: boolean;
};

const campos = { id: true, nombre: true, comisionPct: true, activo: true } as const;

export const metodoPagoRepository = {
  async listar(scope: Scope): Promise<MetodoPago[]> {
    return prisma.metodoPago.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: campos,
      orderBy: { creadoEn: "asc" },
    });
  },

  async contar(scope: Scope): Promise<number> {
    return prisma.metodoPago.count({
      where: { emprendimientoId: scope.emprendimientoId },
    });
  },

  async crear(scope: Scope, datos: NuevoMetodoPago): Promise<MetodoPago> {
    return prisma.metodoPago.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: campos,
    });
  },

  async crearVarios(scope: Scope, datos: NuevoMetodoPago[]): Promise<MetodoPago[]> {
    const filas = datos.map((m) => ({
      ...m,
      id: randomUUID(),
      emprendimientoId: scope.emprendimientoId,
    }));

    await prisma.metodoPago.createMany({ data: filas });

    // Se devuelven en el orden pedido y no releyendo con `orderBy: creadoEn`:
    // `createMany` estampa la misma marca de tiempo en todas las filas y el
    // orden de vuelta sería arbitrario.
    return filas.map(({ id, nombre, comisionPct, activo }) => ({
      id,
      nombre,
      comisionPct,
      activo,
    }));
  },

  /** Devuelve `null` si el método no es de este emprendimiento. */
  async actualizar(
    scope: Scope,
    id: string,
    datos: NuevoMetodoPago,
  ): Promise<MetodoPago | null> {
    const { count } = await prisma.metodoPago.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: datos,
    });

    if (count === 0) return null;

    return prisma.metodoPago.findUniqueOrThrow({ where: { id }, select: campos });
  },

  /** Devuelve `false` si el método no es de este emprendimiento. */
  async eliminar(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.metodoPago.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },
};
