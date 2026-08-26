import { z } from "zod";

/** El dinero es siempre entero de pesos: un decimal aquí es un error de entrada. */
const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const categoriaSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre"),
  precio: pesos,
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
