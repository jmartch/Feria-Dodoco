import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { ventaRepository } from "../repositories/venta.repository.js";
import { ventaService } from "../services/venta.service.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

export const ventaController = {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const venta = await ventaService.registrar(scopeDe(req), req.auth!.usuarioId, {
        ...req.body,
        eventoId: String(req.params.id),
      });

      res.status(201).json(venta);
    } catch (error) {
      next(error);
    }
  },

  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) {
        throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
      }

      res.json(await ventaRepository.listarDelEvento(scope, eventoId));
    } catch (error) {
      next(error);
    }
  },

  /**
   * Borrar una venta lo puede hacer cualquiera en plena feria: es la forma de
   * corregir un cobro mal registrado sin llamar al administrador.
   */
  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) {
        throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
      }

      const borrada = await ventaRepository.eliminar(scope, eventoId, String(req.params.ventaId));
      if (!borrada) {
        throw new ErrorDeNegocio("VENTA_NO_ENCONTRADA", "La venta no existe", 404);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  /**
   * El vendedor ve lo que cobró y cuánto falta para la meta; no ve comisiones
   * ni ganancia neta, porque confunden en plena feria. Esas cifras son del
   * administrador.
   */
  async totales(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) {
        throw new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
      }

      const totales = await ventaRepository.totalesDelEvento(scope, eventoId);
      const comun = {
        cantidadVentas: totales.cantidadVentas,
        bruto: totales.bruto,
        descuentos: totales.descuentos,
        porMetodo: totales.porMetodo,
        meta: evento.meta,
      };

      if (req.auth!.rol !== "ADMIN") {
        res.json(comun);
        return;
      }

      res.json({ ...comun, comisiones: totales.comisiones, neto: totales.neto });
    } catch (error) {
      next(error);
    }
  },
};
