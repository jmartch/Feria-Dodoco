import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Cargando } from "./Cargando";

export function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  // Mientras se restaura la sesión al recargar, no redirigir al login todavía.
  if (cargando) return <Cargando que="tu sesión" />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}
