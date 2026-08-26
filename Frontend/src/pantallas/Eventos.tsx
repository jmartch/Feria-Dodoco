import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import type { Evento } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";
import { Aviso } from "../componentes/Aviso";
import { Calendario } from "../componentes/Calendario";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export function Eventos() {
  const { cliente, usuario } = useAuth();
  const api = useMemo(() => crearApiEventos(cliente), [cliente]);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creando, setCreando] = useState(false);
  const [verCalendario, setVerCalendario] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [fechaFin, setFechaFin] = useState("");
  const [meta, setMeta] = useState(1000000);
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    setEventos(await api.listar());
  }

  useEffect(() => {
    api
      .listar()
      .then(setEventos)
      .catch(() => setError("No se pudieron cargar los eventos."));
  }, [api]);

  const esAdmin = usuario?.rol === "ADMIN";

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !fechaInicio) return;
    setError(null);
    setGuardando(true);
    try {
      await api.crear({
        nombre,
        // Mediodía para que la fecha no retroceda un día en zonas detrás de UTC.
        fechaInicio: new Date(`${fechaInicio}T12:00:00`).toISOString(),
        fechaFin: fechaFin ? new Date(`${fechaFin}T12:00:00`).toISOString() : null,
        meta,
      });
      setNombre("");
      setFechaFin("");
      setMeta(1000000);
      setCreando(false);
      await recargar();
    } catch {
      setError("No se pudo crear el evento.");
    } finally {
      setGuardando(false);
    }
  }

  if (error && !eventos) return <Aviso mensaje={error} />;
  if (!eventos) return <Cargando que="los eventos" />;

  const ordenados = [...eventos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  return (
    <section>
      <div className="eventos-cab">
        <h1>Eventos</h1>
        {esAdmin && (
          <button type="button" onClick={() => setCreando((v) => !v)}>
            {creando ? "Cerrar" : "＋ Nuevo evento"}
          </button>
        )}
      </div>

      {esAdmin && creando && (
        <form onSubmit={crear} className="form-evento">
          <h2>Crear evento</h2>
          {error && <Aviso mensaje={error} />}
          <label>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <label>
            Fecha de inicio
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </label>
          <label>
            Fecha de fin (opcional)
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </label>
          <label>
            Meta (pesos)
            <input
              type="number"
              min={0}
              step={1000}
              value={meta || ""}
              onChange={(e) => setMeta(Math.max(0, Math.trunc(Number(e.target.value))))}
            />
          </label>
          <button type="submit" className="principal" disabled={guardando}>
            Crear evento
          </button>
        </form>
      )}

      {ordenados.length === 0 ? (
        <p className="vacio">
          Aún no hay eventos.{esAdmin ? " Crea el primero con “＋ Nuevo evento”." : ""}
        </p>
      ) : (
        <div className="lista-eventos">
          {ordenados.map((evento) => (
            <div className="evento-card" key={evento.id}>
              <div className="evento-emoji">🎪</div>
              <div className="evento-cuerpo">
                <span className="evento-nombre">{evento.nombre}</span>
                <span className="evento-fecha">{formatearFecha(evento.fechaInicio)}</span>
              </div>
              <div className="evento-acciones">
                <Link to={`/eventos/${evento.id}/panel`} className="evento-chip">Panel</Link>
                <Link to={`/eventos/${evento.id}/vender`} className="evento-chip vender">Vender</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="plegable">
        <button type="button" className="plegable-cab" onClick={() => setVerCalendario((v) => !v)}>
          <span>📅 Calendario</span>
          <span>{verCalendario ? "▲" : "▼"}</span>
        </button>
        {verCalendario && (
          <div className="plegable-cuerpo">
            <Calendario eventos={eventos} />
          </div>
        )}
      </div>
    </section>
  );
}
