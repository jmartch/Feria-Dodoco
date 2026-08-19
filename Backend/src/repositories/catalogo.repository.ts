import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Categoria = {
  id: string;
  nombre: string;
  precio: number;
};

export type NuevaCategoria = {
  nombre: string;
  precio: number;
};

export type Producto = {
  id: string;
  nombre: string;
  precioSugerido: number;
  categoriaId: string;
};

export type NuevoProducto = {
  nombre: string;
  precioSugerido: number;
  categoriaId: string;
};

const camposCategoria = { id: true, nombre: true, precio: true } as const;
const camposProducto = {
  id: true,
  nombre: true,
  precioSugerido: true,
  categoriaId: true,
} as const;

export const catalogoRepository = {
  async listarCategorias(scope: Scope): Promise<Categoria[]> {
    return prisma.categoria.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposCategoria,
      orderBy: { creadaEn: "asc" },
    });
  },

  async crearCategoria(scope: Scope, datos: NuevaCategoria): Promise<Categoria> {
    return prisma.categoria.create({
      // El spread va primero: ni el id ni el emprendimiento pueden sobrescribirse.
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposCategoria,
    });
  },

  /** Devuelve `null` si la categoría no es de este emprendimiento. */
  async actualizarCategoria(
    scope: Scope,
    id: string,
    datos: NuevaCategoria,
  ): Promise<Categoria | null> {
    const { count } = await prisma.categoria.updateMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
      data: datos,
    });

    if (count === 0) return null;

    return prisma.categoria.findUniqueOrThrow({
      where: { id },
      select: camposCategoria,
    });
  },

  /** Devuelve `false` si la categoría no es de este emprendimiento. */
  async eliminarCategoria(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.categoria.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });

    return count === 1;
  },

  async listarProductos(scope: Scope, categoriaId: string): Promise<Producto[]> {
    return prisma.producto.findMany({
      where: { emprendimientoId: scope.emprendimientoId, categoriaId },
      select: camposProducto,
      orderBy: { creadoEn: "asc" },
    });
  },

  /** Devuelve `null` si la categoría indicada no es de este emprendimiento. */
  async crearProducto(scope: Scope, datos: NuevoProducto): Promise<Producto | null> {
    const categoria = await prisma.categoria.findFirst({
      where: { id: datos.categoriaId, emprendimientoId: scope.emprendimientoId },
      select: { id: true },
    });

    if (!categoria) return null;

    return prisma.producto.create({
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposProducto,
    });
  },
};
