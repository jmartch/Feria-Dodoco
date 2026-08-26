import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Gasto = {
  id: string;
  concepto: string;
  categoria: string;
  monto: number;
  creadoEn: Date;
};

export type NuevoGasto = {
  concepto: string;
  categoria: string;
  monto: number;
};

const campos = {
  id: true,
  concepto: true,
  categoria: true,
  monto: true,
  creadoEn: true,
} as const;

export const gastoRepository = {
  async listarDelEvento(scope: Scope, eventoId: string): Promise<Gasto[]> {
    return prisma.gasto.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: campos,
      orderBy: { creadoEn: "asc" },
    });
  },

  async crear(scope: Scope, eventoId: string, datos: NuevoGasto): Promise<Gasto> {
    return prisma.gasto.create({
      data: {
        ...datos,
        id: randomUUID(),
        eventoId,
        emprendimientoId: scope.emprendimientoId,
      },
      select: campos,
    });
  },

  /** Devuelve `false` si el gasto no es de este emprendimiento. */
  async eliminar(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.gasto.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });
    return count === 1;
  },

  async totalDelEvento(scope: Scope, eventoId: string): Promise<number> {
    const gastos = await prisma.gasto.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: { monto: true },
    });
    return gastos.reduce((suma, g) => suma + g.monto, 0);
  },
};
