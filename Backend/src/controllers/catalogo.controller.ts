import type { NextFunction, Request, Response } from "express";
import { catalogoRepository } from "../repositories/catalogo.repository.js";
import { metodoPagoRepository } from "../repositories/metodoPago.repository.js";
import { metodoPagoService } from "../services/metodoPago.service.js";
import { ErrorDeNegocio } from "../errors.js";

const scopeDe = (req: Request) => ({ emprendimientoId: req.auth!.emprendimientoId });

const noEncontrada = new ErrorDeNegocio(
  "CATEGORIA_NO_ENCONTRADA",
  "La categoría no existe",
  404,
);

export const catalogoController = {
  async listarCategorias(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await catalogoRepository.listarCategorias(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crearCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const creada = await catalogoRepository.crearCategoria(scopeDe(req), req.body);
      res.status(201).json(creada);
    } catch (error) {
      next(error);
    }
  },

  async actualizarCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const actualizada = await catalogoRepository.actualizarCategoria(
        scopeDe(req),
        String(req.params.id),
        req.body,
      );

      if (!actualizada) throw noEncontrada;
      res.json(actualizada);
    } catch (error) {
      next(error);
    }
  },

  async eliminarCategoria(req: Request, res: Response, next: NextFunction) {
    try {
      const borrada = await catalogoRepository.eliminarCategoria(
        scopeDe(req),
        String(req.params.id),
      );

      if (!borrada) throw noEncontrada;
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },

  async listarMetodos(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await metodoPagoRepository.listar(scopeDe(req)));
    } catch (error) {
      next(error);
    }
  },

  async crearMetodo(req: Request, res: Response, next: NextFunction) {
    try {
      const creado = await metodoPagoRepository.crear(scopeDe(req), req.body);
      res.status(201).json(creado);
    } catch (error) {
      next(error);
    }
  },

  async preajusteBold(req: Request, res: Response, next: NextFunction) {
    try {
      const metodos = await metodoPagoService.aplicarPreajusteBold(scopeDe(req));
      res.status(201).json(metodos);
    } catch (error) {
      next(error);
    }
  },
};
