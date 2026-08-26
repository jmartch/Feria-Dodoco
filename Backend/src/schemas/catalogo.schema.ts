import { z } from "zod";

/** El dinero es siempre entero de pesos: un decimal aquí es un error de entrada. */
const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const categoriaSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  precio: pesos,
  // Un emoji (opcional). Se limita el largo; no se valida que sea un emoji "real"
  // porque la lista de opciones la controla el frontend.
  icono: z.string().max(16).optional().nullable(),
});

export const metodoPagoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  comisionPct: z
    .number()
    .int("La comisión se expresa en puntos básicos enteros")
    .min(0, "No puede ser negativa")
    .max(10_000, "No puede pasar del 100 %"),
  activo: z.boolean(),
});
