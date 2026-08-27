import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { metodoPagoRepository } from "../repositories/metodoPago.repository.js";
import type { Scope } from "../repositories/scope.js";
import {
  ventaRepository,
  type VentaGuardada,
} from "../repositories/venta.repository.js";
import { calcularVenta, type LineaVendida } from "./calculo.service.js";

export type EntradaVenta = {
  uuid: string;
  eventoId: string;
  lineas: LineaVendida[];
  descuentoId: string | null;
  metodoPagoId: string;
  recibido: number;
  creadaEnDispositivo: Date;
};

export type EntradaEdicion = {
  eventoId: string;
  lineas: LineaVendida[];
  descuentoId: string | null;
  metodoPagoId: string;
  recibido: number;
};

/**
 * Resuelve método y descuento, y calcula la venta. Se comparte entre registrar y
 * editar: la aritmética del dinero y la validación deben ser idénticas en ambos.
 */
async function resolverYCalcular(
  scope: Scope,
  eventoId: string,
  entrada: { lineas: LineaVendida[]; descuentoId: string | null; metodoPagoId: string; recibido: number },
) {
  const metodos = await metodoPagoRepository.listar(scope);
  const metodo = metodos.find((m) => m.id === entrada.metodoPagoId);
  if (!metodo) {
    throw new ErrorDeNegocio("METODO_PAGO_NO_ENCONTRADO", "El método de pago no existe", 404);
  }

  let descuentoNombre: string | null = null;
  let descuentoPct = 0;

  if (entrada.descuentoId) {
    const descuentos = await eventoRepository.listarDescuentos(scope, eventoId);
    const descuento = descuentos.find((d) => d.id === entrada.descuentoId);
    if (!descuento) {
      throw new ErrorDeNegocio("DESCUENTO_NO_ENCONTRADO", "El descuento no existe en este evento", 404);
    }
    descuentoNombre = descuento.nombre;
    descuentoPct = descuento.porcentaje;
  }

  const calculo = calcularVenta({
    lineas: entrada.lineas,
    descuentoPct,
    comisionPct: metodo.comisionPct,
    recibido: entrada.recibido,
  });

  if (calculo.total <= 0) {
    throw new ErrorDeNegocio("VENTA_SIN_PRODUCTOS", "La venta no tiene productos que cobrar", 400);
  }

  return { metodo, descuentoNombre, descuentoPct, calculo };
}

export const ventaService = {
  async registrar(
    scope: Scope,
    usuarioId: string,
    entrada: EntradaVenta,
  ): Promise<VentaGuardada> {
    const evento = await eventoRepository.buscarPorId(scope, entrada.eventoId);
    if (!evento) {
      throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
    }

    if (evento.estado === "CERRADO") {
      throw new ErrorDeNegocio(
        "EVENTO_CERRADO",
        "El evento está cerrado y ya no admite ventas",
        409,
      );
    }

    const { metodo, descuentoNombre, descuentoPct, calculo } = await resolverYCalcular(
      scope,
      entrada.eventoId,
      entrada,
    );

    // Se guardan los porcentajes y nombres de este instante, no referencias:
    // si mañana cambia la tarifa o el precio, el informe de esta feria no cambia.
    return ventaRepository.registrar(scope, {
      uuid: entrada.uuid,
      eventoId: entrada.eventoId,
      usuarioId,
      subtotal: calculo.subtotal,
      descuentoNombre,
      descuentoPct,
      descuentoValor: calculo.descuentoValor,
      total: calculo.total,
      metodoPagoNombre: metodo.nombre,
      comisionPct: metodo.comisionPct,
      comisionValor: calculo.comisionValor,
      neto: calculo.neto,
      recibido: entrada.recibido,
      cambio: calculo.cambio,
      creadaEnDispositivo: entrada.creadaEnDispositivo,
      items: calculo.items,
    });
  },

  /**
   * Corrige una venta ya registrada: recalcula con los mismos criterios que al
   * crearla y reemplaza su detalle. Conserva la hora original de la venta.
   */
  async editar(
    scope: Scope,
    eventoId: string,
    ventaId: string,
    entrada: EntradaEdicion,
  ): Promise<VentaGuardada> {
    const evento = await eventoRepository.buscarPorId(scope, eventoId);
    if (!evento) {
      throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
    }

    const existente = await ventaRepository.buscarEnEvento(scope, eventoId, ventaId);
    if (!existente) {
      throw new ErrorDeNegocio("VENTA_NO_ENCONTRADA", "La venta no existe", 404);
    }

    const { metodo, descuentoNombre, descuentoPct, calculo } = await resolverYCalcular(
      scope,
      eventoId,
      entrada,
    );

    return ventaRepository.actualizar(
      scope,
      ventaId,
      {
        subtotal: calculo.subtotal,
        descuentoNombre,
        descuentoPct,
        descuentoValor: calculo.descuentoValor,
        total: calculo.total,
        metodoPagoNombre: metodo.nombre,
        comisionPct: metodo.comisionPct,
        comisionValor: calculo.comisionValor,
        neto: calculo.neto,
        recibido: entrada.recibido,
        cambio: calculo.cambio,
      },
      calculo.items,
    );
  },
};
