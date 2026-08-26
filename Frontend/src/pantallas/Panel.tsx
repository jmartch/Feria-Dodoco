import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiVentas } from "../api/ventas";
import { crearCola } from "../sync/cola";
import { formatearPesos } from "../dinero/formato";
import type { TotalesEvento } from "../api/tipos";
import { BarraMeta } from "../componentes/BarraMeta";
import { Cargando } from "../componentes/Cargando";

export function Panel() {
  const { id: eventoId = "" } = useParams();
  const { cliente, usuario } = useAuth();
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    apiVentas.totales(eventoId).then(setTotales).catch(() => setTotales(null));
    cola.contarPendientes().then(setPendientes);
  }, [apiVentas, cola, eventoId]);

  if (!totales) return <Cargando que="el panel" />;

  const esAdmin = usuario?.rol === "ADMIN";
  const muestraNeto = esAdmin && totales.comisiones !== undefined && totales.neto !== undefined;

  return (
    <section>
      <h1>Panel</h1>

      {pendientes > 0 && <p className="pendientes">⚠ {pendientes} ventas sin sincronizar</p>}

      <h2>Progreso de la meta</h2>
      <BarraMeta bruto={totales.bruto} meta={totales.meta} />

      <h2>Resumen</h2>
      <div className="stats">
        <div className="stat destacado">
          <span className="stat-valor">{formatearPesos(totales.bruto)}</span>
          <span className="stat-etq">Vendido</span>
        </div>
        <div className="stat">
          <span className="stat-valor">{totales.cantidadVentas}</span>
          <span className="stat-etq">Ventas</span>
        </div>
        {muestraNeto && (
          <>
            <div className="stat admin">
              <span className="stat-valor">{formatearPesos(totales.neto as number)}</span>
              <span className="stat-etq">Neto</span>
            </div>
            <div className="stat">
              <span className="stat-valor">{formatearPesos(totales.comisiones as number)}</span>
              <span className="stat-etq">Comisiones</span>
            </div>
          </>
        )}
      </div>

      <h2>Por método de pago</h2>
      {totales.porMetodo.length === 0 ? (
        <p className="vacio">Aún no hay ventas registradas.</p>
      ) : (
        <div className="metodos-grid">
          {totales.porMetodo.map((m) => (
            <div className="metodo-fila" key={m.metodo}>
              <span>{m.metodo}</span>
              <strong>{formatearPesos(m.total)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
