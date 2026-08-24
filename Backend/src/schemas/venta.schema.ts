import { z } from "zod";

const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const ventaSchema = z.object({
  /** Lo genera el dispositivo. Es la llave que impide duplicar al reintentar. */
  uuid: z.string().min(8, "Falta el identificador de la venta"),
  lineas: z
    .array(
      z.object({
        nombre: z.string().min(1),
        precioUnitario: pesos,
        cantidad: z.number().int("La cantidad debe ser entera").positive("Debe ser mayor que cero"),
      }),
    )
    .min(1, "La venta no tiene productos"),
  metodoPagoId: z.string().min(1, "Falta el método de pago"),
  descuentoId: z.string().nullable(),
  recibido: pesos,
  creadaEnDispositivo: z.coerce.date(),
});
