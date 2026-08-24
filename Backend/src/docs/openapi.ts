import { createDocument } from "zod-openapi";
import { loginSchema, refreshSchema, registroSchema } from "../schemas/auth.schema.js";
import { categoriaSchema, metodoPagoSchema } from "../schemas/catalogo.schema.js";
import {
  candadoSchema,
  descuentoSchema,
  eventoSchema,
  lineaSchema,
} from "../schemas/evento.schema.js";
import { ventaSchema } from "../schemas/venta.schema.js";

export const documentoOpenApi = createDocument({
  openapi: "3.1.0",
  info: {
    title: "API Registro de Ventas",
    version: "1.0.0",
    description:
      "API para registro de ventas en ferias. Todos los montos son enteros de pesos colombianos.",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token de acceso obtenido en /auth/login.",
      },
    },
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
          "400": { description: "Datos inválidos" },
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
          "400": { description: "Datos inválidos" },
          "401": { description: "Refresh token inválido o ya usado" },
        },
      },
    },
    "/auth/yo": {
      get: {
        summary: "Perfil del usuario autenticado",
        // Sin esto, Swagger no muestra el botón "Authorize" y cualquier
        // generador de clientes daría el endpoint por público.
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Datos del usuario" },
          "401": { description: "No autenticado o sesión expirada" },
        },
      },
    },
    "/catalogo/categorias": {
      get: {
        summary: "Listar las categorías del emprendimiento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de categorías" }, "401": { description: "No autenticado" } },
      },
      post: {
        summary: "Crear una categoría",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: categoriaSchema } } },
        responses: {
          "201": { description: "Categoría creada" },
          "400": { description: "Datos inválidos" },
          "403": { description: "Solo el administrador" },
        },
      },
    },
    "/catalogo/categorias/{id}": {
      put: {
        summary: "Actualizar una categoría",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: categoriaSchema } } },
        responses: { "200": { description: "Actualizada" }, "404": { description: "No existe" } },
      },
      delete: {
        summary: "Eliminar una categoría",
        security: [{ bearerAuth: [] }],
        responses: { "204": { description: "Eliminada" }, "404": { description: "No existe" } },
      },
    },
    "/catalogo/metodos-pago": {
      get: {
        summary: "Listar los métodos de pago",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de métodos" } },
      },
      post: {
        summary: "Crear un método de pago",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: metodoPagoSchema } } },
        responses: { "201": { description: "Creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/catalogo/metodos-pago/preajuste-bold": {
      post: {
        summary: "Aplicar las comisiones estándar de Bold (efectivo 0 %, QR 1,5 %, datáfono 5 %)",
        security: [{ bearerAuth: [] }],
        responses: {
          "201": { description: "Métodos creados" },
          "409": { description: "Ya hay métodos configurados" },
        },
      },
    },
    "/eventos": {
      get: {
        summary: "Listar los eventos del emprendimiento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de eventos" } },
      },
      post: {
        summary: "Crear un evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: eventoSchema } } },
        responses: { "201": { description: "Evento creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/eventos/{id}": {
      get: {
        summary: "Obtener un evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "El evento" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/candado": {
      patch: {
        summary: "Bloquear o desbloquear el catálogo del evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: candadoSchema } } },
        responses: { "200": { description: "Candado actualizado" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/lineas": {
      get: {
        summary: "Listar las líneas del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de líneas" } },
      },
      post: {
        summary: "Añadir una línea, trayendo una categoría completa o escribiéndola a mano",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: lineaSchema } } },
        responses: {
          "201": { description: "Línea añadida" },
          "409": { description: "El catálogo está bloqueado" },
        },
      },
    },
    "/eventos/{id}/lineas/{lineaId}": {
      delete: {
        summary: "Eliminar una línea del evento",
        security: [{ bearerAuth: [] }],
        responses: { "204": { description: "Eliminada" }, "404": { description: "No existe" } },
      },
    },
    "/eventos/{id}/descuentos": {
      get: {
        summary: "Listar los descuentos del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de descuentos" } },
      },
      post: {
        summary: "Crear un descuento del evento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: descuentoSchema } } },
        responses: { "201": { description: "Creado" }, "400": { description: "Datos inválidos" } },
      },
    },
    "/eventos/{id}/ventas": {
      get: {
        summary: "Listar las ventas del evento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Lista de ventas" } },
      },
      post: {
        summary: "Registrar una venta. Es idempotente: reenviar el mismo uuid no duplica",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: ventaSchema } } },
        responses: {
          "201": { description: "Venta registrada, o la ya existente con ese uuid" },
          "404": { description: "Evento, método de pago o descuento inexistente" },
          "409": { description: "El evento está cerrado" },
        },
      },
    },
    "/eventos/{id}/totales": {
      get: {
        summary: "Totales del evento. Las comisiones y el neto solo se devuelven al administrador",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Totales del evento" }, "404": { description: "No existe" } },
      },
    },
  },
});
