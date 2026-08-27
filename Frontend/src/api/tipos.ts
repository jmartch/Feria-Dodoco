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
  nombreEmprendimiento: string;
};

export type Sesion = {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
};

export type Categoria = { id: string; nombre: string; precio: number; icono?: string | null };
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

export type Gasto = {
  id: string;
  concepto: string;
  categoria: string;
  monto: number;
  creadoEn: string;
};

export type VentaGuardada = {
  id: string;
  uuid: string;
  total: number;
  metodoPagoNombre: string;
  creadaEnDispositivo: string;
  // El backend los devuelve al listar; opcionales para no romper otros usos.
  subtotal?: number;
  descuentoNombre?: string | null;
  descuentoValor?: number;
  comisionPct?: number;
  comisionValor?: number;
  neto?: number;
  recibido?: number;
  cambio?: number;
  items?: VentaItem[];
};

export type VentaItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
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
