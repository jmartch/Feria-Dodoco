import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { eventoRepository } from "../src/repositories/evento.repository.js";
import { gastoRepository } from "../src/repositories/gasto.repository.js";

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

function crearEvento(emprendimientoId: string) {
  return eventoRepository.crear(
    { emprendimientoId },
    { nombre: "Feria", fechaInicio: new Date(), fechaFin: null, meta: 1000000 },
  );
}

describe("gastos", () => {
  it("registra gastos y suma el total del evento", async () => {
    const evento = await crearEvento(A);
    await gastoRepository.crear(scopeA, evento.id, { concepto: "Transporte", categoria: "Logística", monto: 20000 });
    await gastoRepository.crear(scopeA, evento.id, { concepto: "Bolsas", categoria: "Materiales", monto: 5000 });

    expect(await gastoRepository.totalDelEvento(scopeA, evento.id)).toBe(25000);
    expect(await gastoRepository.listarDelEvento(scopeA, evento.id)).toHaveLength(2);
  });

  it("no muestra ni borra los gastos de otro emprendimiento", async () => {
    const eventoB = await crearEvento(B);
    const ajeno = await gastoRepository.crear(
      { emprendimientoId: B },
      eventoB.id,
      { concepto: "Arriendo", categoria: "Otro", monto: 100000 },
    );

    expect(await gastoRepository.listarDelEvento(scopeA, eventoB.id)).toHaveLength(0);
    expect(await gastoRepository.eliminar(scopeA, ajeno.id)).toBe(false);
    expect(await prisma.gasto.count()).toBe(1);
  });
});
