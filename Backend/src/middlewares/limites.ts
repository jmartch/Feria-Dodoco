import rateLimit from "express-rate-limit";

export const limiteGeneral = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { codigo: "DEMASIADAS_PETICIONES", mensaje: "Espera un momento" },
});

/** Más estricto: frena la fuerza bruta contra el login. */
export const limiteLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos, espera 15 minutos" },
});
