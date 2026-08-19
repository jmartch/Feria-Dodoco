import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { authService } from "../src/services/auth.service.js";
import { verificarPassword } from "../src/services/password.service.js";
import { emprendimientoRepository } from "../src/repositories/emprendimiento.repository.js";

const datos = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(limpiarBaseDeDatos);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("registro de emprendimiento", () => {
  it("crea el emprendimiento con su usuario admin", async () => {
    const usuario = await authService.registrar(datos);

    expect(usuario.rol).toBe("ADMIN");
    expect(usuario.email).toBe("admin@dodoco.co");
    expect(usuario.emprendimientoId).toBeTruthy();
  });

  it("guarda la contraseña cifrada, nunca en texto plano", async () => {
    await authService.registrar(datos);

    const guardado = await prisma.usuario.findUnique({
      where: { email: datos.email },
    });

    expect(guardado?.passwordHash).not.toBe(datos.password);
    expect(guardado?.passwordHash.startsWith("$argon2")).toBe(true);
    await expect(
      verificarPassword(guardado!.passwordHash, datos.password),
    ).resolves.toBe(true);
  });

  it("rechaza un email ya registrado", async () => {
    await authService.registrar(datos);

    await expect(authService.registrar(datos)).rejects.toMatchObject({
      codigo: "EMAIL_YA_REGISTRADO",
    });
  });

  // Ataca la transacción directamente, sin pasar por el guard de email duplicado
  // del servicio. Si no lo hiciera, el guard cortaría antes de tocar la base y la
  // prueba pasaría igual aunque `crearConAdmin` no fuera atómica.
  it("no deja un emprendimiento huérfano si falla la creación del usuario", async () => {
    await authService.registrar(datos);
    const antes = await prisma.emprendimiento.count();

    await expect(
      emprendimientoRepository.crearConAdmin({
        nombreEmprendimiento: "Otro negocio",
        email: datos.email, // choca con la restricción única dentro de la transacción
        passwordHash: "hash-cualquiera",
        nombreUsuario: "Otra persona",
      }),
    ).rejects.toMatchObject({ codigo: "EMAIL_YA_REGISTRADO" });

    expect(await prisma.emprendimiento.count()).toBe(antes);
  });
});
