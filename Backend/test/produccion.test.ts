import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const paquete = JSON.parse(readFileSync("package.json", "utf8"));

describe("configuración de producción", () => {
  // Comprueba el ORDEN, no solo la presencia: arrancar el servidor antes de
  // aplicar las migraciones dejaría la API sirviendo contra un esquema viejo.
  it("aplica las migraciones antes de arrancar el servidor", () => {
    expect(paquete.scripts["start:prod"]).toMatch(
      /prisma migrate deploy\s*&&\s*node dist\/server\.js/,
    );
  });

  // Prueba de comportamiento, no de texto: sin el secreto, importar el módulo
  // debe fallar. Una versión que buscara la cadena "process.env.JWT_ACCESS_SECRET"
  // en el archivo seguiría pasando aunque alguien reintrodujera un valor de
  // reserva al lado, que es justo la regresión que hay que impedir.
  it("falla al arrancar si falta el secreto de firma, en vez de usar uno por defecto", async () => {
    vi.resetModules();
    vi.stubEnv("JWT_ACCESS_SECRET", "");

    await expect(
      import("../src/services/token.service.js"),
    ).rejects.toThrow(/JWT_ACCESS_SECRET/);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
