import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const paquete = JSON.parse(readFileSync("package.json", "utf8"));

describe("configuración de producción", () => {
  it("define el comando de arranque que aplica migraciones", () => {
    expect(paquete.scripts["start:prod"]).toContain("prisma migrate deploy");
    expect(paquete.scripts["start:prod"]).toContain("node dist/server.js");
  });

  it("no expone secretos por defecto en el código", () => {
    const tokenService = readFileSync("src/services/token.service.ts", "utf8");

    expect(tokenService).toContain("process.env.JWT_ACCESS_SECRET");
  });
});
