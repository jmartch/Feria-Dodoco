import type { NextFunction, Request, Response } from "express";
import { ErrorDeNegocio } from "../errors.js";
import { eventoRepository } from "../repositories/evento.repository.js";
import { gastoRepository } from "../repositories/gasto.repository.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

const eventoNoEncontrado = new ErrorDeNegocio("EVENTO_NO_ENCONTRADO", "El evento no existe", 404);
const gastoNoEncontrado = new ErrorDeNegocio("GASTO_NO_ENCONTRADO", "El gasto no existe", 404);

export const gastoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;

      const gastos = await gastoRepository.listarDelEvento(scope, eventoId);
      const total = gastos.reduce((suma, g) => suma + g.monto, 0);
      res.json({ gastos, total });
    } catch (error) {
      next(error);
    }
  },

  async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = scopeDe(req);
      const eventoId = String(req.params.id);
      const evento = await eventoRepository.buscarPorId(scope, eventoId);
      if (!evento) throw eventoNoEncontrado;

      const creado = await gastoRepository.crear(scope, eventoId, req.body);
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },

  async eliminar(req: Request, res: Response, next: NextFunction) {
    try {
      const borrado = await gastoRepository.eliminar(scopeDe(req), String(req.params.gastoId));
      if (!borrado) throw gastoNoEncontrado;
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
};
