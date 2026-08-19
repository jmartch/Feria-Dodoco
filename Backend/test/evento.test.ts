import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { catalogoRepository } from "../src/repositories/catalogo.repository.js";
import { eventoRepository } from "../src/repositories/evento.repository.js";
import { eventoService } from "../src/services/evento.service.js";

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

async function crearEvento(emprendimientoId: string) {
  return eventoRepository.crear(
    { emprendimientoId },
    { nombre: "Feria de abril", fechaInicio: new Date(), fechaFin: null, meta: 1000000 },
  );
}

describe("eventos y líneas", () => {
  it("traer una categoría crea UNA sola línea con su nombre y precio", async () => {
    const evento = await crearEvento(A);
    const categoria = await catalogoRepository.crearCategoria(scopeA, {
      nombre: "Medias",
      precio: 15000,
    });

    const linea = await eventoService.agregarCategoriaComoLinea(scopeA, evento.id, categoria.id);

    expect(linea.nombre).toBe("Medias");
    expect(linea.precio).toBe(15000);
    expect(linea.origenTipo).toBe("CATEGORIA");

    const lineas = await eventoRepository.listarLineas(scopeA, evento.id);
    expect(lineas).toHaveLength(1);
  });

  it("la línea conserva el precio aunque después cambie el de la categoría", async () => {
    const evento = await crearEvento(A);
    const categoria = await catalogoRepository.crearCategoria(scopeA, {
      nombre: "Medias",
      precio: 15000,
    });
    await eventoService.agregarCategoriaComoLinea(scopeA, evento.id, categoria.id);

    await catalogoRepository.actualizarCategoria(scopeA, categoria.id, {
      nombre: "Medias",
      precio: 20000,
    });

    const [linea] = await eventoRepository.listarLineas(scopeA, evento.id);
    expect(linea.precio).toBe(15000);
  });

  it("con el catálogo bloqueado no se pueden añadir líneas", async () => {
    const evento = await crearEvento(A);
    await eventoRepository.cambiarCandado(scopeA, evento.id, true);

    await expect(
      eventoService.agregarLineaManual(scopeA, evento.id, {
        nombre: "Improvisado",
        precio: 5000,
      }),
    ).rejects.toMatchObject({ codigo: "CATALOGO_BLOQUEADO" });

    expect(await eventoRepository.listarLineas(scopeA, evento.id)).toHaveLength(0);
  });

  it("al quitar el candado se pueden volver a añadir líneas", async () => {
    const evento = await crearEvento(A);
    await eventoRepository.cambiarCandado(scopeA, evento.id, true);
    await eventoRepository.cambiarCandado(scopeA, evento.id, false);

    const linea = await eventoService.agregarLineaManual(scopeA, evento.id, {
      nombre: "Improvisado",
      precio: 5000,
    });

    expect(linea.origenTipo).toBe("MANUAL");
  });

  it("no deja añadir una línea a un evento de otro emprendimiento", async () => {
    const ajeno = await crearEvento(B);

    await expect(
      eventoService.agregarLineaManual(scopeA, ajeno.id, { nombre: "Robado", precio: 1 }),
    ).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });

    expect(await prisma.eventoItem.count()).toBe(0);
  });

  it("no deja traer una categoría de otro emprendimiento a un evento propio", async () => {
    const evento = await crearEvento(A);
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    await expect(
      eventoService.agregarCategoriaComoLinea(scopeA, evento.id, ajena.id),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_NO_ENCONTRADA" });
  });
});
