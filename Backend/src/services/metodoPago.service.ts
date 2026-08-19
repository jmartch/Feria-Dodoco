import { ErrorDeNegocio } from "../errors.js";
import {
  metodoPagoRepository,
  type MetodoPago,
  type NuevoMetodoPago,
} from "../repositories/metodoPago.repository.js";
import type { Scope } from "../repositories/scope.js";

/**
 * Comisiones estándar de Bold, en puntos básicos (centésimas de porcentaje):
 * 150 son 1,5 % y 500 son 5 %. Se guardan como enteros porque el proyecto no
 * admite flotantes en nada que toque dinero.
 */
export const PRESET_BOLD: NuevoMetodoPago[] = [
  { nombre: "Efectivo", comisionPct: 0, activo: true },
  { nombre: "QR", comisionPct: 150, activo: true },
  { nombre: "Datáfono", comisionPct: 500, activo: true },
];

export const metodoPagoService = {
  async aplicarPreajusteBold(scope: Scope): Promise<MetodoPago[]> {
    const existentes = await metodoPagoRepository.contar(scope);

    if (existentes > 0) {
      throw new ErrorDeNegocio(
        "METODOS_YA_CONFIGURADOS",
        "Ya tienes métodos de pago configurados. Edítalos o bórralos antes de aplicar el preajuste.",
        409,
      );
    }

    return metodoPagoRepository.crearVarios(scope, PRESET_BOLD);
  },
};
