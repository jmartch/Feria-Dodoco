import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("documentación de la API", () => {
  it("publica el documento OpenAPI con todos los endpoints", async () => {
    const res = await request(createApp()).get("/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths).sort()).toEqual([
      "/auth/login",
      "/auth/refresh",
      "/auth/registro",
      "/auth/yo",
      "/catalogo/categorias",
      "/catalogo/categorias/{id}",
      "/catalogo/metodos-pago",
      "/catalogo/metodos-pago/preajuste-bold",
      "/eventos",
      "/eventos/{id}",
      "/eventos/{id}/candado",
      "/eventos/{id}/descuentos",
      "/eventos/{id}/lineas",
      "/eventos/{id}/lineas/{lineaId}",
      "/eventos/{id}/totales",
      "/eventos/{id}/ventas",
    ]);
  });

  it("todos los endpoints del dominio exigen token", async () => {
    const res = await request(createApp()).get("/docs.json");
    const paths = res.body.paths as Record<string, Record<string, { security?: unknown }>>;

    const delDominio = Object.keys(paths).filter((p) => !p.startsWith("/auth/"));
    expect(delDominio.length).toBeGreaterThan(0);

    for (const ruta of delDominio) {
      for (const operacion of Object.values(paths[ruta])) {
        expect(operacion.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it("declara que el perfil exige token, para que no se lea como público", async () => {
    const res = await request(createApp()).get("/docs.json");

    expect(res.body.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(res.body.paths["/auth/yo"].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it("sirve la interfaz de Swagger", async () => {
    const res = await request(createApp()).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger");
  });
});
