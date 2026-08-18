import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { authService } from "../src/services/auth.service.js";
import { verificarAccessToken } from "../src/services/token.service.js";

const datos = {
  nombreEmprendimiento: "Dodoco Store",
  email: "admin@dodoco.co",
  password: "clave-segura-123",
  nombreUsuario: "Juan",
};

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await authService.registrar(datos);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("login y tokens", () => {
  it("entrega un access token con el emprendimiento del usuario", async () => {
    const sesion = await authService.login(datos.email, datos.password);
    const payload = verificarAccessToken(sesion.accessToken);

    expect(payload.sub).toBe(sesion.usuario.id);
    expect(payload.emprendimientoId).toBe(sesion.usuario.emprendimientoId);
    expect(payload.rol).toBe("ADMIN");
  });

  it("rechaza la contraseña incorrecta sin revelar si el email existe", async () => {
    await expect(
      authService.login(datos.email, "clave-equivocada"),
    ).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });

    await expect(
      authService.login("noexiste@dodoco.co", "loquesea"),
    ).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
  });

  it("rechaza un access token manipulado", () => {
    expect(() => verificarAccessToken("token.falso.aqui")).toThrow();
  });

  it("guarda el refresh token hasheado, nunca en claro", async () => {
    const sesion = await authService.login(datos.email, datos.password);

    const enClaro = await prisma.refreshToken.findFirst({
      where: { tokenHash: sesion.refreshToken },
    });

    expect(enClaro).toBeNull();
    expect(await prisma.refreshToken.count()).toBe(1);
  });

  it("dos refrescos simultáneos con el mismo token: solo uno gana", async () => {
    const sesion = await authService.login(datos.email, datos.password);

    const resultados = await Promise.allSettled([
      authService.refrescar(sesion.refreshToken),
      authService.refrescar(sesion.refreshToken),
    ]);

    const exitosos = resultados.filter((r) => r.status === "fulfilled");
    expect(exitosos).toHaveLength(1);
  });

  it("al refrescar entrega tokens nuevos e invalida el anterior", async () => {
    const primera = await authService.login(datos.email, datos.password);
    const segunda = await authService.refrescar(primera.refreshToken);

    expect(segunda.refreshToken).not.toBe(primera.refreshToken);

    await expect(
      authService.refrescar(primera.refreshToken),
    ).rejects.toMatchObject({ codigo: "REFRESH_INVALIDO" });
  });
});
