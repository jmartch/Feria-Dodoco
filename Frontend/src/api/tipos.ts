export class ErrorApi extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly estado: number,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

export type Rol = "ADMIN" | "VENDEDOR";

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  emprendimientoId: string;
};

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
};

export type Categoria = { id: string; nombre: string; precio: number };
export type MetodoPago = { id: string; nombre: string; comisionPct: number; activo: boolean };

export type Evento = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string | null;
  meta: number;
  catalogoBloqueado: boolean;
  estado: "ACTIVO" | "CERRADO";
};

export type EventoItem = {
  id: string;
  nombre: string;
  precio: number;
  origenTipo: "CATEGORIA" | "PRODUCTO" | "MANUAL";
  origenId: string | null;
};

export type Descuento = { id: string; nombre: string; porcentaje: number; activo: boolean };

export type VentaGuardada = {
  id: string;
  uuid: string;
  total: number;
  metodoPagoNombre: string;
  creadaEnDispositivo: string;
};

export type TotalesEvento = {
  cantidadVentas: number;
  bruto: number;
  descuentos: number;
  porMetodo: { metodo: string; total: number }[];
  meta: number;
  // Solo presentes para ADMIN; el backend los omite al vendedor.
  comisiones?: number;
  neto?: number;
};
