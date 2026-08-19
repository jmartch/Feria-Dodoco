import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("esquema base", () => {
  it("guarda un emprendimiento junto con su usuario admin", async () => {
    const emprendimiento = await prisma.emprendimiento.create({
      data: {
        id: randomUUID(),
        nombre: "Dodoco Store",
        usuarios: {
          create: {
            id: randomUUID(),
            email: "admin@dodoco.co",
            passwordHash: "hash-de-prueba",
            nombre: "Juan",
            rol: "ADMIN",
          },
        },
      },
      include: { usuarios: true },
    });

    expect(emprendimiento.metaPorDefecto).toBe(1000000);
    expect(emprendimiento.usuarios).toHaveLength(1);
    expect(emprendimiento.usuarios[0].rol).toBe("ADMIN");
  });

  it("no permite dos usuarios con el mismo email", async () => {
    const crear = (email: string) =>
      prisma.emprendimiento.create({
        data: {
          id: randomUUID(),
          nombre: "Tienda",
          usuarios: {
            create: { id: randomUUID(), email, passwordHash: "h", nombre: "N" },
          },
        },
      });

    await crear("repetido@dodoco.co");

    await expect(crear("repetido@dodoco.co")).rejects.toThrow();
  });
});
