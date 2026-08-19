import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Evento = {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  meta: number;
  catalogoBloqueado: boolean;
  estado: "ACTIVO" | "CERRADO";
};

export type NuevoEvento = {
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  meta: number;
};

export type EventoItem = {
  id: string;
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type NuevaLinea = {
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type Descuento = {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
};

export type NuevoDescuento = {
  nombre: string;
  porcentaje: number;
  activo: boolean;
};

const camposEvento = {
  id: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  meta: true,
  catalogoBloqueado: true,
  estado: true,
} as const;

const camposLinea = {
  id: true,
  nombre: true,
  precio: true,
  origenTipo: true,
  origenId: true,
} as const;

const camposDescuento = {
  id: true,
  nombre: true,
  porcentaje: true,
  activo: true,
} as const;

export const eventoRepository = {
  async listar(scope: Scope): Promise<Evento[]> {
    return prisma.evento.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposEvento,
      orderBy: { fechaInicio: "desc" },
    });
  },

  async crear(scope: Scope, datos: NuevoEvento): Promise<Evento> {
    return prisma.evento.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposEvento,
    });
  },

  async buscarPorId(scope: Scope, id: string): Promise<Evento | null> {
    return prisma.evento.findFirst({
      where: { id, emprendimientoId: scope.emprendimientoId },
      select: camposEvento,
    });
  },

  /** Devuelve `null` si el evento no es de este emprendimiento. */
  async cambiarCandado(
    scope: Scope,
    id: string,
    bloqueado: boolean,
  ): Promise<Evento | null> {
    const { count } = await prisma.evento.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: { catalogoBloqueado: bloqueado },
    });

    if (count === 0) return null;

    return prisma.evento.findUniqueOrThrow({ where: { id }, select: camposEvento });
  },

  async listarLineas(scope: Scope, eventoId: string): Promise<EventoItem[]> {
    return prisma.eventoItem.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: camposLinea,
      orderBy: { creadoEn: "asc" },
    });
  },

  async crearLinea(
    scope: Scope,
    eventoId: string,
    datos: NuevaLinea,
  ): Promise<EventoItem> {
    return prisma.eventoItem.create({
      data: {
        ...datos,
        id: randomUUID(),
        eventoId,
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposLinea,
    });
  },

  /** Devuelve `false` si la línea no es de este emprendimiento. */
  async eliminarLinea(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.eventoItem.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },

  async listarDescuentos(scope: Scope, eventoId: string): Promise<Descuento[]> {
    return prisma.descuento.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: camposDescuento,
      orderBy: { creadoEn: "asc" },
    });
  },

  async crearDescuento(
    scope: Scope,
    eventoId: string,
    datos: NuevoDescuento,
  ): Promise<Descuento> {
    return prisma.descuento.create({
      data: {
        ...datos,
        id: randomUUID(),
        eventoId,
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposDescuento,
    });
  },
};
