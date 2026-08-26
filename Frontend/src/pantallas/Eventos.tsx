import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import type { Evento } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";
import { Aviso } from "../componentes/Aviso";

export function Eventos() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiEventos(cliente), [cliente]);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listar()
      .then(setEventos)
      .catch(() => setError("No se pudieron cargar los eventos."));
  }, [api]);

  if (error) return <Aviso mensaje={error} />;
  if (!eventos) return <Cargando que="los eventos" />;

  return (
    <section>
      <h1>Eventos</h1>
      {eventos.length === 0 ? (
        <p>Aún no hay eventos.</p>
      ) : (
        <ul>
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link to={`/eventos/${evento.id}/vender`}>{evento.nombre}</Link>
              {" · "}
              <Link to={`/eventos/${evento.id}/panel`}>Panel</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
