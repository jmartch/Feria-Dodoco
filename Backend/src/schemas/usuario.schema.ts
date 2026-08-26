import { z } from "zod";

export const empleadoSchema = z.object({
  nombre: z.string().min(2, "Escribe el nombre del vendedor"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
