import { z } from "zod";

export const registroSchema = z.object({
  nombreEmprendimiento: z.string().min(2, "Escribe el nombre del emprendimiento"),
  nombreUsuario: z.string().min(2, "Escribe tu nombre"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Falta el token"),
});
