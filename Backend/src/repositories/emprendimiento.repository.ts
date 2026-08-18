import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import { ErrorDeNegocio } from "../errors.js";
import type { Scope } from "./scope.js";
import type { UsuarioSeguro } from "./usuario.repository.js";

export type NuevoEmprendimiento = {
  nombreEmprendimiento: string;
  email: string;
  passwordHash: string;
  nombreUsuario: string;
};

export type Emprendimiento = {
  id: string;
  nombre: string;
  logo: string | null;
  metaPorDefecto: number;
};

/**
 * Traduce el choque de la restricción única de email a un error de dominio.
 * Vive en el repositorio porque es la capa que conoce los códigos de Prisma:
 * los servicios no deben saber qué es un "P2002".
 */
function esEmailDuplicado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export const emprendimientoRepository = {
  /**
   * Crea el emprendimiento y su usuario ADMIN en una sola transacción:
   * nunca debe quedar un emprendimiento sin nadie que pueda entrar.
   *
   * Si dos registros simultáneos usan el mismo correo, la transacción perdedora
   * revierte entera y su error se traduce a `ErrorDeNegocio`, para que el
   * contrato de errores sea el mismo con o sin concurrencia.
   */
  async crearConAdmin(
    datos: NuevoEmprendimiento,
  ): Promise<{ emprendimientoId: string; usuario: UsuarioSeguro }> {
    const emprendimientoId = randomUUID();

    try {
    const usuario = await prisma.$transaction(async (tx) => {
      await tx.emprendimiento.create({
        data: { id: emprendimientoId, nombre: datos.nombreEmprendimiento },
      });

      return tx.usuario.create({
        data: {
          id: randomUUID(),
          emprendimientoId,
          email: datos.email,
          passwordHash: datos.passwordHash,
          nombre: datos.nombreUsuario,
          rol: "ADMIN",
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          emprendimientoId: true,
        },
      });
    });

    return { emprendimientoId, usuario };
    } catch (error) {
      if (esEmailDuplicado(error)) {
        throw new ErrorDeNegocio(
          "EMAIL_YA_REGISTRADO",
          "Ese correo ya tiene una cuenta",
          409,
        );
      }
      throw error;
    }
  },

  async buscarPorId(scope: Scope): Promise<Emprendimiento | null> {
    return prisma.emprendimiento.findUnique({
      where: { id: scope.emprendimientoId },
      select: { id: true, nombre: true, logo: true, metaPorDefecto: true },
    });
  },
};
