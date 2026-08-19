import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("documentación de la API", () => {
  it("publica el documento OpenAPI con los endpoints de auth", async () => {
    const res = await request(createApp()).get("/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths).sort()).toEqual([
      "/auth/login",
      "/auth/refresh",
      "/auth/registro",
      "/auth/yo",
    ]);
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
