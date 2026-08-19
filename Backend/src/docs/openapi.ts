import { createDocument } from "zod-openapi";
import { loginSchema, refreshSchema, registroSchema } from "../schemas/auth.schema.js";

export const documentoOpenApi = createDocument({
  openapi: "3.1.0",
  info: {
    title: "API Registro de Ventas",
    version: "1.0.0",
    description:
      "API para registro de ventas en ferias. Todos los montos son enteros de pesos colombianos.",
  },
  paths: {
    "/auth/registro": {
      post: {
        summary: "Crear un emprendimiento con su usuario administrador",
        requestBody: { content: { "application/json": { schema: registroSchema } } },
        responses: {
          "201": { description: "Emprendimiento creado" },
          "400": { description: "Datos inválidos" },
          "409": { description: "El correo ya tiene cuenta" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Iniciar sesión",
        requestBody: { content: { "application/json": { schema: loginSchema } } },
        responses: {
          "200": { description: "Sesión iniciada" },
          "401": { description: "Credenciales inválidas" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Renovar la sesión con un refresh token",
        requestBody: { content: { "application/json": { schema: refreshSchema } } },
        responses: {
          "200": { description: "Sesión renovada" },
          "401": { description: "Refresh token inválido o ya usado" },
        },
      },
    },
    "/auth/yo": {
      get: {
        summary: "Perfil del usuario autenticado",
        responses: {
          "200": { description: "Datos del usuario" },
          "401": { description: "No autenticado" },
        },
      },
    },
  },
});
