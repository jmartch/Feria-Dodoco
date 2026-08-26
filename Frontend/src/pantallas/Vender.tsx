import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { crearApiVentas } from "../api/ventas";
import { crearApiCatalogo } from "../api/catalogo";
import { crearCola } from "../sync/cola";
import { calcularVenta } from "../dinero/calculo";
import { formatearPesos } from "../dinero/formato";
import type { Descuento, EventoItem, MetodoPago } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";

export function Vender() {
  const { id: eventoId = "" } = useParams();
  const { cliente } = useAuth();
  const apiEventos = useMemo(() => crearApiEventos(cliente), [cliente]);
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const apiCatalogo = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);

  const [lineas, setLineas] = useState<EventoItem[] | null>(null);
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [descuentoId, setDescuentoId] = useState<string | null>(null);
  const [metodoId, setMetodoId] = useState<string>("");
  const [recibido, setRecibido] = useState<number>(0);

  useEffect(() => {
    Promise.all([
      apiEventos.listarLineas(eventoId),
      apiEventos.listarDescuentos(eventoId),
      apiCatalogo.listarMetodos(),
    ]).then(([ls, ds, ms]) => {
      setLineas(ls);
      setDescuentos(ds.filter((d) => d.activo));
      setMetodos(ms.filter((m) => m.activo));
      if (ms[0]) setMetodoId(ms[0].id);
    });
  }, [apiEventos, apiCatalogo, eventoId]);

  const descuentoActivo = descuentos.find((d) => d.id === descuentoId) ?? null;
  const metodoActivo = metodos.find((m) => m.id === metodoId) ?? null;

  const calculo = useMemo(() => {
    const items = (lineas ?? []).map((l) => ({
      nombre: l.nombre,
      precioUnitario: l.precio,
      cantidad: cantidades[l.id] ?? 0,
    }));
    return calcularVenta({
      lineas: items,
      descuentoPct: descuentoActivo?.porcentaje ?? 0,
      comisionPct: metodoActivo?.comisionPct ?? 0,
      recibido,
    });
  }, [lineas, cantidades, descuentoActivo, metodoActivo, recibido]);

  function cambiarCantidad(lineaId: string, delta: number) {
    setCantidades((prev) => ({ ...prev, [lineaId]: Math.max(0, (prev[lineaId] ?? 0) + delta) }));
  }

  async function registrar() {
    if (calculo.total <= 0 || !metodoActivo) return;
    const cuerpo = {
      uuid: crypto.randomUUID(),
      lineas: calculo.items.map((i) => ({ nombre: i.nombre, precioUnitario: i.precioUnitario, cantidad: i.cantidad })),
      metodoPagoId: metodoActivo.id,
      descuentoId: descuentoActivo?.id ?? null,
      recibido,
      creadaEnDispositivo: new Date().toISOString(),
    };
    // Local-first: se guarda y se limpia sin esperar a la red. La cola envía sola.
    await cola.encolar(eventoId, cuerpo);
    setCantidades({});
    setRecibido(0);
    setDescuentoId(null);
    void cola.sincronizar();
  }

  if (!lineas) return <Cargando que="la venta" />;

  return (
    <section>
      <h1>Vender</h1>

      <h2>Productos</h2>
      {lineas.length === 0 ? (
        <p className="venta-vacia">Este evento aún no tiene productos. Agrégalos en “Líneas”.</p>
      ) : (
        <ul className="venta-lista">
          {lineas.map((linea) => {
            const cantidad = cantidades[linea.id] ?? 0;
            return (
              <li key={linea.id} aria-label={linea.nombre} className={`sel-fila${cantidad > 0 ? " activo" : ""}`}>
                <div className="prod-emoji">🛍️</div>
                <div className="sel-info">
                  <div className="sel-nombre">{linea.nombre}</div>
                  <div className="sel-precio">{formatearPesos(linea.precio)}</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => cambiarCantidad(linea.id, -1)}>−</button>
                  <span className="cant">{cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(linea.id, 1)}>+</button>
                </div>
                <span className="sel-subtotal">{formatearPesos(linea.precio * cantidad)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {descuentos.length > 0 && (
        <>
          <h2>Descuentos</h2>
          <div className="chips">
            {descuentos.map((d) => (
              <label key={d.id}>
                <input
                  type="radio"
                  name="descuento"
                  checked={descuentoId === d.id}
                  onChange={() => setDescuentoId(descuentoId === d.id ? null : d.id)}
                />
                {d.nombre}
              </label>
            ))}
          </div>
        </>
      )}

      <h2>Método de pago</h2>
      <div className="chips">
        {metodos.map((m) => (
          <label key={m.id}>
            <input type="radio" name="metodo" checked={metodoId === m.id} onChange={() => setMetodoId(m.id)} />
            {m.nombre}
          </label>
        ))}
      </div>

      <div className="cobro">
        <div className="cobro-total">
          <span>Total a cobrar</span>
          <strong>{formatearPesos(calculo.total)}</strong>
        </div>
        <div className="cobro-pago">
          <label>
            Recibido
            <input
              type="number"
              min={0}
              step={1}
              value={recibido || ""}
              onChange={(e) => setRecibido(Math.max(0, Math.trunc(Number(e.target.value))))}
            />
          </label>
          <button type="button" onClick={() => setRecibido(calculo.total)}>Pago exacto</button>
        </div>
        <div className="cobro-cambio">
          <span>Cambio</span>
          <strong>{formatearPesos(calculo.cambio)}</strong>
        </div>
        <button type="button" className="principal" onClick={registrar} disabled={calculo.total <= 0}>
          Registrar venta
        </button>
      </div>
    </section>
  );
}
