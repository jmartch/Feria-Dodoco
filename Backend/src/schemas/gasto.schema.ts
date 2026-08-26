import { z } from "zod";

const pesos = z
  .number()
  .int("Debe ser un número entero de pesos")
  .positive("El gasto debe ser mayor que cero");

export const gastoSchema = z.object({
  concepto: z.string().min(1, "Escribe en qué gastaste"),
  categoria: z.string().min(1, "Elige una categoría"),
  monto: pesos,
});
