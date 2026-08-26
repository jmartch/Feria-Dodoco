import { Link } from "react-router-dom";
import type { Usuario } from "../api/tipos";

export function Navegacion({ usuario, salir }: { usuario: Usuario; salir: () => void }) {
  return (
    <nav>
      <Link to="/eventos" className="nav-marca">
        <img src="/logo.png" alt="Dodoco Store" />
      </Link>
      <Link to="/eventos">Eventos</Link>
      {usuario.rol === "ADMIN" && (
        <>
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/configuracion">Configuración</Link>
        </>
      )}
      <span>{usuario.nombre}</span>
      <button type="button" onClick={salir}>Salir</button>
    </nav>
  );
}
