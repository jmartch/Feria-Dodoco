import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { ventaRepository } from "../repositories/venta.repository.js";
import { eventoService } from "../services/evento.service.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

const eventoNoEncontrado = new ErrorDeNegocio(
  "EVENTO_NO_ENCONTRADO",
  "El evento no existe",
  404,
);

export const eventoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await eventoRepository.listar(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const creado = await eventoRepository.crear(scopeDe(req), {
        nombre: req.body.nombre,
        fechaInicio: req.body.fechaInicio,
        fechaFin: req.body.fechaFin ?? null,
        meta: req.body.meta,
      });
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },

  /** Reiniciar feria: borra todas las ventas y conserva la configuración. */
  async reiniciar(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;

      const borradas = await ventaRepository.eliminarTodasDelEvento(scope, eventoId);
      res.json({ ventasEliminadas: borradas });
    } catch (error) {
      next(error);
    }
  },

  /** Eliminar feria: borra el evento completo (ventas, gastos, líneas, descuentos). */
  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const borrado = await eventoRepository.eliminar(scopeDe(req), String(req.params.id));
      if (!borrado) throw eventoNoEncontrado;
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async obtener(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.buscarPorId(scopeDe(req), String(req.params.id));
      if (!evento) throw eventoNoEncontrado;
      res.json(evento);
    } catch (error) {
      next(error);
    }
  },

  async cambiarCandado(req: Request, res: Response, next: NextFunction) {
    try {
      const evento = await eventoRepository.cambiarCandado(
        scopeDe(req),
        String(req.params.id),
        req.body.bloqueado,
      );
      if (!evento) throw eventoNoEncontrado;
      res.json(evento);
    } catch (error) {
      next(error);
    }
  },

  async listarLineas(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;
      res.json(await eventoRepository.listarLineas(scope, eventoId));
    } catch (error) {
      next(error);
    }
  },

  async crearLinea(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const linea =
        "categoriaId" in req.body
          ? await eventoService.agregarCategoriaComoLinea(
              scope,
              eventoId,
              req.body.categoriaId,
            )
          : await eventoService.agregarLineaManual(scope, eventoId, req.body);

      res.status(201).json(linea);
    } catch (error) {
      next(error);
    }
  },

  async eliminarLinea(req: Request, res: Response, next: NextFunction) {
    try {
      const borrada = await eventoRepository.eliminarLinea(
        scopeDe(req),
        String(req.params.lineaId),
      );

      if (!borrada) {
        throw new ErrorDeNegocio("LINEA_NO_ENCONTRADA", "La línea no existe", 404);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listarDescuentos(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;
      res.json(await eventoRepository.listarDescuentos(scope, eventoId));
    } catch (error) {
      next(error);
    }
  },

  async crearDescuento(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;

      const creado = await eventoRepository.crearDescuento(
        scope,
        eventoId,
        req.body,
      );
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },
};
