import { ErrorApi, type Sesion } from "./tipos";

export type OpcionesCliente = {
  baseUrl: string;
  obtenerAccessToken: () => string | null;
  obtenerRefreshToken: () => string | null;
  alRenovar: (sesion: Sesion) => void;
  alPerderSesion: () => void;
};

export type OpcionesPedir = RequestInit & { autenticar?: boolean };

export type Cliente = {
  pedir: <T>(ruta: string, init?: OpcionesPedir) => Promise<T>;
};

async function aError(respuesta: Response): Promise<ErrorApi> {
  // El backend siempre responde { codigo, mensaje }, pero un 401 sin cuerpo o un
  // fallo de red pueden no traerlo: se cae a un mensaje genérico.
  try {
    const cuerpo = (await respuesta.json()) as { codigo?: string; mensaje?: string };
    return new ErrorApi(
      cuerpo.codigo ?? "ERROR_DESCONOCIDO",
      cuerpo.mensaje ?? "No se pudo completar la operación",
      respuesta.status,
    );
  } catch {
    return new ErrorApi("ERROR_DESCONOCIDO", "No se pudo completar la operación", respuesta.status);
  }
}

export function crearCliente(opciones: OpcionesCliente): Cliente {
  async function ejecutar(ruta: string, init: OpcionesPedir): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (init.autenticar !== false) {
      const token = opciones.obtenerAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${opciones.baseUrl}${ruta}`, { ...init, headers });
  }

  async function renovar(): Promise<boolean> {
    const refreshToken = opciones.obtenerRefreshToken();
    if (!refreshToken) return false;

    const respuesta = await fetch(`${opciones.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!respuesta.ok) return false;

    const sesion = (await respuesta.json()) as Sesion;
    opciones.alRenovar(sesion);
    return true;
  }

  async function pedir<T>(ruta: string, init: OpcionesPedir = {}): Promise<T> {
    let respuesta = await ejecutar(ruta, init);

    // 401 con token vencido: renovar y reintentar una sola vez. Nunca se
    // reintenta la renovación misma, para no entrar en bucle.
    if (respuesta.status === 401 && init.autenticar !== false) {
      const renovada = await renovar();
      if (!renovada) {
        opciones.alPerderSesion();
        throw await aError(respuesta);
      }
      respuesta = await ejecutar(ruta, init);
      if (respuesta.status === 401) {
        opciones.alPerderSesion();
        throw await aError(respuesta);
      }
    }

    if (!respuesta.ok) throw await aError(respuesta);
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
  }

  return { pedir };
}
