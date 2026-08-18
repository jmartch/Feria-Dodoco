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

export type NuevoUsuario = {
  emprendimientoId: string;
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

  async crear(datos: NuevoUsuario): Promise<UsuarioSeguro> {
    return prisma.usuario.create({
      data: { id: randomUUID(), ...datos },
      select: camposSeguros,
    });
  },
};
