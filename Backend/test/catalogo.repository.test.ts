import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../src/infra/prisma.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import { catalogoRepository } from "../src/repositories/catalogo.repository.js";

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

describe("catálogo con aislamiento", () => {
  it("solo lista las categorías del emprendimiento del scope", async () => {
    await catalogoRepository.crearCategoria({ emprendimientoId: A }, { nombre: "Pines", precio: 12000 });
    await catalogoRepository.crearCategoria({ emprendimientoId: B }, { nombre: "Medias", precio: 15000 });

    const deA = await catalogoRepository.listarCategorias({ emprendimientoId: A });

    expect(deA).toHaveLength(1);
    expect(deA[0].nombre).toBe("Pines");
  });

  it("no deja actualizar una categoría de otro emprendimiento aunque se sepa su id", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const resultado = await catalogoRepository.actualizarCategoria(
      { emprendimientoId: A },
      ajena.id,
      { nombre: "Robada", precio: 1 },
    );

    expect(resultado).toBeNull();

    const sigueIgual = await prisma.categoria.findUnique({ where: { id: ajena.id } });
    expect(sigueIgual?.nombre).toBe("Medias");
    expect(sigueIgual?.precio).toBe(15000);
  });

  it("no deja eliminar una categoría de otro emprendimiento", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const borradas = await catalogoRepository.eliminarCategoria({ emprendimientoId: A }, ajena.id);

    expect(borradas).toBe(false);
    expect(await prisma.categoria.count()).toBe(1);
  });

  it("no deja colgar un producto de una categoría de otro emprendimiento", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );

    const producto = await catalogoRepository.crearProducto(
      { emprendimientoId: A },
      { nombre: "Media rayada", precioSugerido: 15000, categoriaId: ajena.id },
    );

    expect(producto).toBeNull();
    expect(await prisma.producto.count()).toBe(0);
  });

  // `listarProductos` es la única lectura de productos: si perdiera el filtro por
  // emprendimiento, un scope ajeno vería el catálogo del vecino con solo conocer un
  // id de categoría. Se prueba pidiendo desde A la categoría de B.
  it("no lista los productos de una categoría de otro emprendimiento", async () => {
    const ajena = await catalogoRepository.crearCategoria(
      { emprendimientoId: B },
      { nombre: "Medias", precio: 15000 },
    );
    await catalogoRepository.crearProducto(
      { emprendimientoId: B },
      { nombre: "Media rayada", precioSugerido: 15000, categoriaId: ajena.id },
    );

    const propia = await catalogoRepository.crearCategoria(
      { emprendimientoId: A },
      { nombre: "Pines", precio: 12000 },
    );
    await catalogoRepository.crearProducto(
      { emprendimientoId: A },
      { nombre: "Pin de Dodoco", precioSugerido: 12000, categoriaId: propia.id },
    );

    expect(await catalogoRepository.listarProductos({ emprendimientoId: A }, ajena.id)).toEqual([]);

    // El otro lado de la prueba: el filtro no puede ser tan agresivo que devuelva
    // vacío siempre; con la categoría propia el producto sí tiene que aparecer.
    const propios = await catalogoRepository.listarProductos({ emprendimientoId: A }, propia.id);
    expect(propios).toHaveLength(1);
    expect(propios[0].nombre).toBe("Pin de Dodoco");
  });
});
