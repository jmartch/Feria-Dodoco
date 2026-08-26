import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { usuarioService } from "../src/services/usuario.service.js";

const A = "emp-a";
const B = "emp-b";
const scopeA = { emprendimientoId: A };

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await prisma.emprendimiento.createMany({
    data: [
      { id: A, nombre: "Dodoco" },
      { id: B, nombre: "Medias Pao" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("empleados", () => {
  it("el dueño crea un vendedor en su emprendimiento", async () => {
    const empleado = await usuarioService.crearEmpleado(scopeA, {
      nombre: "Vale",
      email: "vale@dodoco.co",
      password: "clave12345",
    });

    expect(empleado.rol).toBe("VENDEDOR");
    expect(empleado.emprendimientoId).toBe(A);

    const equipo = await usuarioService.listarEquipo(scopeA);
    expect(equipo.map((u) => u.email)).toContain("vale@dodoco.co");
  });

  it("no deja repetir un correo ya registrado", async () => {
    await usuarioService.crearEmpleado(scopeA, { nombre: "Vale", email: "vale@dodoco.co", password: "clave12345" });

    await expect(
      usuarioService.crearEmpleado(scopeA, { nombre: "Otra", email: "vale@dodoco.co", password: "clave12345" }),
    ).rejects.toMatchObject({ codigo: "EMAIL_YA_REGISTRADO" });
  });

  it("el equipo de un emprendimiento no incluye a los del otro", async () => {
    await usuarioService.crearEmpleado(
      { emprendimientoId: B },
      { nombre: "Ajena", email: "ajena@b.co", password: "clave12345" },
    );

    const equipoA = await usuarioService.listarEquipo(scopeA);
    expect(equipoA.map((u) => u.email)).not.toContain("ajena@b.co");
  });
});
