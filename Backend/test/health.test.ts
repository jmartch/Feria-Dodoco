import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /health", () => {
  it("responde 200 con estado ok", async () => {
    const respuesta = await request(createApp()).get("/health");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: "ok" });
  });
});
