import { z } from "zod";

const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .nonnegative("No puede ser negativo");

export const eventoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre del evento"),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().nullable().optional(),
  meta: pesos,
});

export const candadoSchema = z.object({
  bloqueado: z.boolean(),
});

/**
 * Una línea se añade de dos formas: trayendo una categoría completa, o
 * escribiéndola a mano. La unión discriminada obliga a elegir una, y evita
 * peticiones ambiguas con los dos caminos a medias.
 */
export const lineaSchema = z.union([
  z.object({ categoriaId: z.string().min(1) }),
  z.object({
    nombre: z.string().min(1, "Escribe el nombre de la línea"),
    precio: pesos,
  }),
]);

export const descuentoSchema = z.object({
  nombre: z.string().min(1, "Escribe el nombre del descuento"),
  porcentaje: z
    .number()
    .int("El porcentaje se expresa en puntos básicos enteros")
    .min(0, "No puede ser negativo")
    .max(10_000, "No puede pasar del 100 %"),
  activo: z.boolean(),
});
