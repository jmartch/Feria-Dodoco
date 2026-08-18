import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
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

export const emprendimientoRepository = {
  /**
   * Crea el emprendimiento y su usuario ADMIN en una sola transacción:
   * nunca debe quedar un emprendimiento sin nadie que pueda entrar.
   */
  async crearConAdmin(
    datos: NuevoEmprendimiento,
  ): Promise<{ emprendimientoId: string; usuario: UsuarioSeguro }> {
    const emprendimientoId = randomUUID();

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
  },

  async buscarPorId(scope: Scope): Promise<Emprendimiento | null> {
    return prisma.emprendimiento.findUnique({
      where: { id: scope.emprendimientoId },
      select: { id: true, nombre: true, logo: true, metaPorDefecto: true },
    });
  },
};
