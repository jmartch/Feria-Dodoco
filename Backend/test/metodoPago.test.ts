import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { metodoPagoRepository } from "../src/repositories/metodoPago.repository.js";
import { metodoPagoService, PRESET_BOLD } from "../src/services/metodoPago.service.js";

const A = "emp-a";
const B = "emp-b";

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

describe("métodos de pago", () => {
  it("el preajuste de Bold crea efectivo, QR y datáfono con sus comisiones", async () => {
    const metodos = await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    expect(metodos).toHaveLength(3);
    expect(metodos.map((m) => [m.nombre, m.comisionPct])).toEqual([
      ["Efectivo", 0],
      ["QR", 150],
      ["Datáfono", 500],
    ]);
  });

  it("las comisiones del preajuste están en puntos básicos, no en decimales", () => {
    const qr = PRESET_BOLD.find((m) => m.nombre === "QR");

    // 1,5 % son 150 puntos básicos. Un 1.5 aquí sería un flotante y rompería
    // la regla de que el dinero y sus porcentajes son siempre enteros.
    expect(qr?.comisionPct).toBe(150);
    expect(Number.isInteger(qr?.comisionPct)).toBe(true);
  });

  it("no aplica el preajuste dos veces sobre el mismo emprendimiento", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    await expect(
      metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A }),
    ).rejects.toMatchObject({ codigo: "METODOS_YA_CONFIGURADOS" });

    expect(await metodoPagoRepository.contar({ emprendimientoId: A })).toBe(3);
  });

  // `listar` es lo que alimenta los botones de cobro del vendedor. Sin la columna
  // `orden` el criterio era `creadoEn`, y `createMany` estampa la misma marca de
  // tiempo en las tres filas: MySQL devolvía "QR, Datáfono, Efectivo", dejando de
  // último el método más usado en una feria.
  it("listar devuelve el preajuste en el orden en que se pidió, no el que decida MySQL", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    const nombres = async () =>
      (await metodoPagoRepository.listar({ emprendimientoId: A })).map((m) => m.nombre);

    expect(await nombres()).toEqual(["Efectivo", "QR", "Datáfono"]);
    // Dos lecturas seguidas tienen que dar lo mismo: el orden es del dato, no del
    // plan de consulta.
    expect(await nombres()).toEqual(["Efectivo", "QR", "Datáfono"]);
  });

  it("un método creado después del preajuste queda de último", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });
    await metodoPagoRepository.crear(
      { emprendimientoId: A },
      { nombre: "Nequi", comisionPct: 0, activo: true },
    );

    const lista = await metodoPagoRepository.listar({ emprendimientoId: A });

    expect(lista.map((m) => m.nombre)).toEqual(["Efectivo", "QR", "Datáfono", "Nequi"]);
  });

  it("el preajuste de un emprendimiento no aparece en el otro", async () => {
    await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: A });

    expect(await metodoPagoRepository.listar({ emprendimientoId: B })).toHaveLength(0);
  });

  it("no deja actualizar un método de pago de otro emprendimiento", async () => {
    const [efectivo] = await metodoPagoService.aplicarPreajusteBold({ emprendimientoId: B });

    const resultado = await metodoPagoRepository.actualizar(
      { emprendimientoId: A },
      efectivo.id,
      { nombre: "Secuestrado", comisionPct: 9999, activo: true },
    );

    expect(resultado).toBeNull();
  });
});
