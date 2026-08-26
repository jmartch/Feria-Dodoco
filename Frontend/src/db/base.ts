import Dexie, { type Table } from "dexie";

export type VentaPendiente = {
  uuid: string;
  eventoId: string;
  cuerpo: unknown;
  estado: "pendiente" | "sincronizada";
  intentos: number;
  creadaEn: string;
};

class BaseDodoco extends Dexie {
  ventasPendientes!: Table<VentaPendiente, string>;

  constructor() {
    super("dodoco");
    // `uuid` es la clave primaria: reencolar la misma venta la sobrescribe en
    // vez de duplicarla. `estado` indexado para buscar las pendientes rápido.
    this.version(1).stores({ ventasPendientes: "uuid, estado, eventoId" });
  }
}

export const db = new BaseDodoco();
