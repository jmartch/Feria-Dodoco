import rateLimit, { type Options } from "express-rate-limit";

const enPruebas = process.env.NODE_ENV === "test";

/**
 * Fábrica de limitadores.
 *
 * Los limitadores montados en la aplicación se desactivan bajo pruebas: su
 * contador vive en memoria y se comparte entre todos los casos de un mismo
 * archivo, así que una suite que haga muchas peticiones empezaría a recibir 429
 * ajenos a lo que está verificando y fallaría por una razón falsa. El
 * comportamiento del limitador se prueba aparte, con una instancia propia que
 * anula ese `skip`.
 */
export function crearLimitador(opciones: Partial<Options>) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => enPruebas,
    ...opciones,
  });
}

export const limiteGeneral = crearLimitador({
  windowMs: 60_000,
  limit: 120,
  message: { codigo: "DEMASIADAS_PETICIONES", mensaje: "Espera un momento" },
});

/** Más estricto: frena la fuerza bruta contra el login. */
export const limiteLogin = crearLimitador({
  windowMs: 15 * 60_000,
  limit: 10,
  message: { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos, espera 15 minutos" },
});
