import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { crearCliente, type Cliente } from "../api/cliente";
import { crearApiAuth, type DatosRegistro } from "../api/auth";
import type { Sesion, Usuario } from "../api/tipos";
import { almacenamiento } from "./almacenamiento";

type ValorAuth = {
  usuario: Usuario | null;
  cargando: boolean;
  cliente: Cliente;
  entrar: (email: string, password: string) => Promise<void>;
  registrar: (datos: DatosRegistro) => Promise<void>;
  salir: () => void;
};

const Contexto = createContext<ValorAuth | null>(null);

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  // Al arrancar, si hay refresh token guardado, se intenta restaurar la sesión;
  // mientras tanto `cargando` evita que las rutas protegidas manden al login.
  const [cargando, setCargando] = useState<boolean>(() => Boolean(almacenamiento.leerRefresh()));
  // El access token vive en una ref (memoria), no en el estado: cambiarlo no
  // debe re-renderizar, y no debe persistirse.
  const accessRef = useRef<string | null>(null);

  const cliente = useMemo(
    () =>
      crearCliente({
        baseUrl: BASE_URL,
        obtenerAccessToken: () => accessRef.current,
        obtenerRefreshToken: () => almacenamiento.leerRefresh(),
        alRenovar: (sesion) => aplicarSesion(sesion),
        alPerderSesion: () => limpiarSesion(),
      }),
    [],
  );

  function aplicarSesion(sesion: Sesion) {
    accessRef.current = sesion.accessToken;
    almacenamiento.guardarRefresh(sesion.refreshToken);
    setUsuario(sesion.usuario);
  }

  function limpiarSesion() {
    accessRef.current = null;
    almacenamiento.borrarRefresh();
    setUsuario(null);
  }

  const auth = crearApiAuth(cliente);

  // Restauración de sesión al recargar (F5): sin access token en memoria, la
  // primera petición da 401 y el cliente renueva sola con el refresh guardado,
  // dejando la sesión aplicada. Si no hay refresh válido, se queda deslogueado.
  useEffect(() => {
    if (!almacenamiento.leerRefresh()) return;
    cliente
      .pedir<Usuario>("/auth/yo")
      .then(setUsuario)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [cliente]);

  async function entrar(email: string, password: string) {
    aplicarSesion(await auth.login(email, password));
  }

  async function registrar(datos: DatosRegistro) {
    // El registro no devuelve tokens: tras crear la cuenta se entra con las
    // mismas credenciales.
    await auth.registrar(datos);
    await entrar(datos.email, datos.password);
  }

  const valor: ValorAuth = { usuario, cargando, cliente, entrar, registrar, salir: limpiarSesion };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ValorAuth {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return valor;
}
