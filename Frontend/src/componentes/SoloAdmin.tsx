import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SoloAdmin() {
  const { usuario } = useAuth();
  // El vendedor no ve las pantallas de administración; se le devuelve a eventos.
  if (usuario?.rol !== "ADMIN") return <Navigate to="/eventos" replace />;
  return <Outlet />;
}
