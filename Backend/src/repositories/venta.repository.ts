import { randomUUID } from "node:crypto";
import { prisma } from "../infra/prisma.js";
import type { Scope } from "./scope.js";

export type VentaGuardada = {
  id: string;
  uuid: string;
  subtotal: number;
  descuentoNombre: string | null;
  descuentoPct: number;
  descuentoValor: number;
  total: number;
  metodoPagoNombre: string;
  comisionPct: number;
  comisionValor: number;
  neto: number;
  recibido: number;
  cambio: number;
  creadaEnDispositivo: Date;
};

export type NuevaVenta = Omit<VentaGuardada, "id"> & {
  eventoId: string;
  usuarioId: string;
  items: { nombre: string; precioUnitario: number; cantidad: number; subtotal: number }[];
};

export type TotalesEvento = {
  cantidadVentas: number;
  bruto: number;
  descuentos: number;
  comisiones: number;
  neto: number;
  porMetodo: { metodo: string; total: number }[];
};

const campos = {
  id: true,
  uuid: true,
  subtotal: true,
  descuentoNombre: true,
  descuentoPct: true,
  descuentoValor: true,
  total: true,
  metodoPagoNombre: true,
  comisionPct: true,
  comisionValor: true,
  neto: true,
  recibido: true,
  cambio: true,
  creadaEnDispositivo: true,
} as const;

/** Detecta el choque de la restricción única sobre `uuid`. */
function esUuidRepetido(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export const ventaRepository = {
  async buscarPorUuid(scope: Scope, uuid: string): Promise<VentaGuardada | null> {
    return prisma.venta.findFirst({
      where: { uuid, emprendimientoId: scope.emprendimientoId },
      select: campos,
    });
  },

  /**
   * Inserta la venta y su detalle en una transacción. Si el `uuid` ya existía,
   * devuelve la venta guardada en vez de fallar: reenviar es lo normal cuando
   * el celular pierde la señal a mitad de envío, y no debe duplicar nada.
   *
   * La idempotencia se apoya en la restricción única de la base, no en una
   * consulta previa: entre consultar y escribir cabe una carrera.
   */
  async registrar(scope: Scope, venta: NuevaVenta): Promise<VentaGuardada> {
    const { items, eventoId, usuarioId, ...cabecera } = venta;
    const id = randomUUID();

    try {
      return await prisma.$transaction(async (tx) => {
        const creada = await tx.venta.create({
          data: {
            ...cabecera,
            id,
            eventoId,
            usuarioId,
            emprendimientoId: scope.emprendimientoId,
          },
          select: campos,
        });

        await tx.ventaItem.createMany({
          data: items.map((item) => ({
            ...item,
            id: randomUUID(),
            ventaId: id,
            emprendimientoId: scope.emprendimientoId,
          })),
        });

        return creada;
      });
    } catch (error) {
      if (esUuidRepetido(error)) {
        const existente = await this.buscarPorUuid(scope, venta.uuid);
        if (existente) return existente;
      }
      throw error;
    }
  },

  async listarDelEvento(scope: Scope, eventoId: string): Promise<VentaGuardada[]> {
    return prisma.venta.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: campos,
      orderBy: { creadaEnDispositivo: "desc" },
    });
  },

  async totalesDelEvento(scope: Scope, eventoId: string): Promise<TotalesEvento> {
    const ventas = await prisma.venta.findMany({
      where: { eventoId, emprendimientoId: scope.emprendimientoId },
      select: {
        total: true,
        descuentoValor: true,
        comisionValor: true,
        neto: true,
        metodoPagoNombre: true,
      },
    });

    const acumuladoPorMetodo = new Map<string, number>();

    for (const venta of ventas) {
      acumuladoPorMetodo.set(
        venta.metodoPagoNombre,
        (acumuladoPorMetodo.get(venta.metodoPagoNombre) ?? 0) + venta.total,
      );
    }

    return {
      cantidadVentas: ventas.length,
      bruto: ventas.reduce((s, v) => s + v.total, 0),
      descuentos: ventas.reduce((s, v) => s + v.descuentoValor, 0),
      comisiones: ventas.reduce((s, v) => s + v.comisionValor, 0),
      neto: ventas.reduce((s, v) => s + v.neto, 0),
      porMetodo: [...acumuladoPorMetodo].map(([metodo, total]) => ({ metodo, total })),
    };
  },
};
