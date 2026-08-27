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
 * Métodos de pago que toda tienda nueva trae listos: el usuario no debe crearlos
 * a mano. Efectivo va primero (orden 0) para ser el que aparece seleccionado por
 * defecto. Comisiones estándar de Bold en puntos básicos (QR 1,5 %, datáfono 5 %).
 */
const METODOS_POR_DEFECTO = [
  { nombre: "Efectivo", comisionPct: 0 },
  { nombre: "QR", comisionPct: 150 },
  { nombre: "Datáfono", comisionPct: 500 },
];

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

      // La tienda nace con sus métodos de pago listos.
      await tx.metodoPago.createMany({
        data: METODOS_POR_DEFECTO.map((m, i) => ({
          id: randomUUID(),
          nombre: m.nombre,
          comisionPct: m.comisionPct,
          activo: true,
          orden: i,
          emprendimientoId,
        })),
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

    return {
      emprendimientoId,
      // El nombre de la tienda ya lo conocemos por la entrada; se adjunta plano.
      usuario: { ...usuario, nombreEmprendimiento: datos.nombreEmprendimiento.trim() },
    };
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
