/**
 * Identifica al emprendimiento dueño de los datos.
 * Toda operación de negocio contra la base de datos lo exige como primer
 * parámetro. Es lo que sustituye al RLS que MySQL no ofrece.
 */
export type Scope = {
  emprendimientoId: string;
};
