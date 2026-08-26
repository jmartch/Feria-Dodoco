import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type Rol = "ADMIN" | "VENDEDOR";

export type UsuarioSeguro = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  emprendimientoId: string;
};

export type UsuarioConHash = UsuarioSeguro & {
  passwordHash: string;
};

/**
 * Datos de negocio del usuario. NO incluye `emprendimientoId` a propósito:
 * ese valor entra por `scope`, que sale del token y nunca del cuerpo de la
 * petición. Así es imposible crear un usuario dentro de un emprendimiento ajeno.
 */
export type NuevoUsuario = {
  email: string;
  passwordHash: string;
  nombre: string;
  rol: Rol;
};

/** Campos que se devuelven siempre; excluye passwordHash a propósito. */
const camposSeguros = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  emprendimientoId: true,
} as const;

export const usuarioRepository = {
  async listar(scope: Scope): Promise<UsuarioSeguro[]> {
    return prisma.usuario.findMany({
      where: { emprendimientoId: scope.emprendimientoId },
      select: camposSeguros,
      orderBy: { creadoEn: "asc" },
    });
  },

  async buscarPorId(scope: Scope, id: string): Promise<UsuarioSeguro | null> {
    return prisma.usuario.findFirst({
      where: { id, emprendimientoId: scope.emprendimientoId },
      select: camposSeguros,
    });
  },

  /**
   * Excepción documentada al aislamiento: en el login todavía no se sabe a qué
   * emprendimiento pertenece quien entra. Solo debe usarla el servicio de
   * autenticación, nunca un endpoint de negocio.
   */
  async buscarPorEmailGlobal(email: string): Promise<UsuarioConHash | null> {
    return prisma.usuario.findUnique({
      where: { email },
      select: { ...camposSeguros, passwordHash: true },
    });
  },

  /** Excepción documentada: solo para renovar sesión a partir de un refresh token válido. */
  async buscarPorIdGlobal(id: string): Promise<UsuarioSeguro | null> {
    return prisma.usuario.findUnique({ where: { id }, select: camposSeguros });
  },

  async crear(scope: Scope, datos: NuevoUsuario): Promise<UsuarioSeguro> {
    return prisma.usuario.create({
      // El spread va primero y los campos controlados después: así ni el id ni
      // el emprendimiento pueden ser sobrescritos por quien llama.
      data: {
        ...datos,
        id: randomUUID(),
        emprendimientoId: scope.emprendimientoId,
      },
      select: camposSeguros,
    });
  },

  /** Devuelve `false` si el usuario no es de este emprendimiento. */
  async eliminar(scope: Scope, id: string): Promise<boolean> {
    const { count } = await prisma.usuario.deleteMany({
      where: { id, emprendimientoId: scope.emprendimientoId },
    });
    return count === 1;
  },
};
