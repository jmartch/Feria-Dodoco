import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { emprendimientoRepository } from "../src/repositories/emprendimiento.repository.js";
import { usuarioRepository } from "../src/repositories/usuario.repository.js";

let empA = "";
let empB = "";
let usuarioDeB = "";

beforeEach(async () => {
  await limpiarBaseDeDatos();

  const a = await emprendimientoRepository.crearConAdmin({
    nombreEmprendimiento: "Dodoco",
    email: "a@dodoco.co",
    passwordHash: "hash-a",
    nombreUsuario: "Ana",
  });
  const b = await emprendimientoRepository.crearConAdmin({
    nombreEmprendimiento: "Medias Pao",
    email: "b@medias.co",
    passwordHash: "hash-b",
    nombreUsuario: "Beto",
  });

  empA = a.emprendimientoId;
  empB = b.emprendimientoId;
  usuarioDeB = b.usuario.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("aislamiento entre emprendimientos", () => {
  it("listar solo devuelve usuarios del emprendimiento del scope", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empA });

    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].email).toBe("a@dodoco.co");
  });

  it("no deja leer un usuario de otro emprendimiento aunque se sepa su id", async () => {
    const fuga = await usuarioRepository.buscarPorId(
      { emprendimientoId: empA },
      usuarioDeB,
    );

    expect(fuga).toBeNull();
  });

  it("nunca expone el hash de la contraseña en las lecturas normales", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empA });

    expect(usuarios[0]).not.toHaveProperty("passwordHash");
  });

  it("crearConAdmin deja exactamente un admin por emprendimiento", async () => {
    const usuarios = await usuarioRepository.listar({ emprendimientoId: empB });

    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].rol).toBe("ADMIN");
  });
});
