import { ErrorDeNegocio } from "../errors.js";
import { catalogoRepository } from "../repositories/catalogo.repository.js";
import {
  eventoRepository,
  type EventoItem,
} from "../repositories/evento.repository.js";
import type { Scope } from "../repositories/scope.js";

/**
 * Comprueba que el evento existe, es de este emprendimiento y admite cambios en
 * su catálogo. El candado es lo que impide que alguien toque los precios con la
 * fila de clientes al frente.
 */
async function exigirEventoEditable(scope: Scope, eventoId: string) {
  const evento = await eventoRepository.buscarPorId(scope, eventoId);

  if (!evento) {
    throw new ErrorDeNegocio(
      "EVENTO_NO_ENCONTRADO",
      "El evento no existe",
      404,
    );
  }

  if (evento.catalogoBloqueado) {
    throw new ErrorDeNegocio(
      "CATALOGO_BLOQUEADO",
      "El catálogo del evento está bloqueado. Quita el candado para editarlo.",
      409,
    );
  }

  return evento;
}

export const eventoService = {
  /**
   * Trae una categoría completa como UNA sola línea. Copia nombre y precio en
   * ese momento: si mañana cambia el precio de la categoría, lo vendido en esta
   * feria sigue diciendo la verdad.
   *
   * Si la categoría ya está en el evento devuelve la línea existente en vez de
   * duplicarla: dos botones idénticos en la pantalla de venta solo confunden al
   * vendedor, y quien quiera esa categoría a otro precio usa una línea manual.
   */
  async agregarCategoriaComoLinea(
    scope: Scope,
    eventoId: string,
    categoriaId: string,
  ): Promise<EventoItem> {
    await exigirEventoEditable(scope, eventoId);

    const categorias = await catalogoRepository.listarCategorias(scope);
    const categoria = categorias.find((c) => c.id === categoriaId);

    if (!categoria) {
      throw new ErrorDeNegocio(
        "CATEGORIA_NO_ENCONTRADA",
        "La categoría no existe",
        404,
      );
    }

    const lineas = await eventoRepository.listarLineas(scope, eventoId);
    const yaEsta = lineas.find(
      (l) => l.origenTipo === "CATEGORIA" && l.origenId === categoria.id,
    );

    if (yaEsta) return yaEsta;

    return eventoRepository.crearLinea(scope, eventoId, {
      nombre: categoria.nombre,
      precio: categoria.precio,
      origenTipo: "CATEGORIA",
      origenId: categoria.id,
    });
  },

  async agregarLineaManual(
    scope: Scope,
    eventoId: string,
    datos: { nombre: string; precio: number },
  ): Promise<EventoItem> {
    await exigirEventoEditable(scope, eventoId);

    return eventoRepository.crearLinea(scope, eventoId, {
      ...datos,
      origenTipo: "MANUAL",
      origenId: null,
    });
  },
};
