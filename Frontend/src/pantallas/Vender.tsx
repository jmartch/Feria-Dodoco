import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { crearApiEventos } from "../api/eventos";
import { crearApiVentas } from "../api/ventas";
import { crearApiCatalogo } from "../api/catalogo";
import { crearCola } from "../sync/cola";
import { calcularVenta } from "../dinero/calculo";
import { formatearPesos } from "../dinero/formato";
import { ventasACSV, descargarCSV } from "../dinero/csv";
import { mensajeDelDia } from "../dinero/mensaje";
import type { Descuento, MetodoPago, TotalesEvento, VentaGuardada } from "../api/tipos";
import { BarraMeta } from "../componentes/BarraMeta";
import { Cargando } from "../componentes/Cargando";

// Producto vendible: sale directo del catálogo del emprendimiento.
type Producto = { id: string; nombre: string; precio: number; icono: string | null };

// El método en efectivo es el único que pide "recibido" y calcula cambio.
const esEfectivoNombre = (nombre: string) => /efectivo/i.test(nombre);

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

export function Vender() {
  const { id: eventoId = "" } = useParams();
  const { cliente, usuario } = useAuth();
  const apiEventos = useMemo(() => crearApiEventos(cliente), [cliente]);
  const apiVentas = useMemo(() => crearApiVentas(cliente), [cliente]);
  const apiCatalogo = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const cola = useMemo(() => crearCola(apiVentas), [apiVentas]);
  const esAdmin = usuario?.rol === "ADMIN";

  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [descuentos, setDescuentos] = useState<Descuento[]>([]);
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [totales, setTotales] = useState<TotalesEvento | null>(null);
  const [ventas, setVentas] = useState<VentaGuardada[]>([]);
  const [nombreFeria, setNombreFeria] = useState("");
  const [verResumen, setVerResumen] = useState(false);
  const [aviso, setAviso] = useState(false);

  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [descuentoId, setDescuentoId] = useState<string | null>(null);
  const [metodoId, setMetodoId] = useState<string>("");
  const [recibido, setRecibido] = useState<number>(0);

  const refrescarResumen = useCallback(() => {
    apiVentas.totales(eventoId).then(setTotales).catch(() => {});
    apiVentas.listar(eventoId).then(setVentas).catch(() => {});
  }, [apiVentas, eventoId]);

  useEffect(() => {
    Promise.all([
      apiCatalogo.listarCategorias(),
      apiEventos.listarDescuentos(eventoId),
      apiCatalogo.listarMetodos(),
    ]).then(([cats, ds, ms]) => {
      setProductos(cats.map((c) => ({ id: c.id, nombre: c.nombre, precio: c.precio, icono: c.icono ?? null })));
      setDescuentos(ds.filter((d) => d.activo));
      const activos = ms.filter((m) => m.activo);
      setMetodos(activos);
      // Efectivo es el método por defecto; si no existe, el primero de la lista.
      const efectivo = activos.find((m) => esEfectivoNombre(m.nombre));
      if (efectivo) setMetodoId(efectivo.id);
      else if (activos[0]) setMetodoId(activos[0].id);
    });
    apiEventos.buscar(eventoId).then((e) => setNombreFeria(e.nombre)).catch(() => {});
    refrescarResumen();
  }, [apiCatalogo, apiEventos, eventoId, refrescarResumen]);

  const descuentoActivo = descuentos.find((d) => d.id === descuentoId) ?? null;
  const metodoActivo = metodos.find((m) => m.id === metodoId) ?? null;
  const esEfectivo = metodoActivo ? esEfectivoNombre(metodoActivo.nombre) : true;

  const calculo = useMemo(() => {
    const items = (productos ?? []).map((p) => ({
      nombre: p.nombre,
      precioUnitario: p.precio,
      cantidad: cantidades[p.id] ?? 0,
    }));
    return calcularVenta({
      lineas: items,
      descuentoPct: descuentoActivo?.porcentaje ?? 0,
      comisionPct: metodoActivo?.comisionPct ?? 0,
      recibido,
    });
  }, [productos, cantidades, descuentoActivo, metodoActivo, recibido]);

  function cambiarCantidad(productoId: string, delta: number) {
    setCantidades((prev) => ({ ...prev, [productoId]: Math.max(0, (prev[productoId] ?? 0) + delta) }));
  }

  async function registrar() {
    if (calculo.total <= 0 || !metodoActivo) return;
    // Sin efectivo no hay vueltas: se registra "recibido = total" para que el cambio sea 0.
    const recibidoFinal = esEfectivo ? recibido : calculo.total;
    const cuerpo = {
      uuid: crypto.randomUUID(),
      lineas: calculo.items.map((i) => ({ nombre: i.nombre, precioUnitario: i.precioUnitario, cantidad: i.cantidad })),
      metodoPagoId: metodoActivo.id,
      descuentoId: descuentoActivo?.id ?? null,
      recibido: recibidoFinal,
      // La hora de la venta queda registrada aquí, en el momento exacto del cobro.
      creadaEnDispositivo: new Date().toISOString(),
    };
    // Local-first: se guarda y se limpia sin esperar a la red. La cola envía sola.
    await cola.encolar(eventoId, cuerpo);
    setCantidades({});
    setRecibido(0);
    setDescuentoId(null);
    // Confirmación visible para evitar registros duplicados por falta de respuesta.
    setAviso(true);
    window.setTimeout(() => setAviso(false), 2500);
    await cola.sincronizar();
    refrescarResumen();
  }

  async function borrarVenta(id: string) {
    if (!window.confirm("¿Eliminar esta venta? No se puede deshacer.")) return;
    try {
      await apiVentas.eliminar(eventoId, id);
    } catch {
      // Si aún estaba en la cola (sin id de servidor) no pasa nada; se refresca igual.
    }
    refrescarResumen();
  }

  function exportar() {
    descargarCSV(`ventas-${eventoId}.csv`, ventasACSV(ventas));
  }

  async function compartir() {
    if (ventas.length === 0) return;
    const texto = mensajeDelDia(nombreFeria || "la feria", ventas);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Resumen de ventas", text: texto });
      } else {
        // Sin compartir nativo (escritorio): se abre WhatsApp con el texto listo.
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      }
    } catch {
      // El usuario canceló el diálogo de compartir; no es un error.
    }
  }

  if (!productos) return <Cargando que="la venta" />;

  // La venta recién registrada arriba: retroalimentación inmediata.
  const ventasRecientes = [...ventas].reverse();

  return (
    <section>
      <h1>Vender</h1>

      {aviso && (
        <div className="toast-ok" role="status" aria-live="polite">
          ✅ Venta registrada correctamente
        </div>
      )}

      <div className="resumen-dia">
        <BarraMeta bruto={totales?.bruto ?? 0} meta={totales?.meta ?? 0} />
        <div className="resumen-acciones">
          <button type="button" onClick={() => setVerResumen((v) => !v)}>
            {verResumen ? "Ocultar resumen" : "Ver resumen"}
          </button>
          <button type="button" onClick={compartir} disabled={ventas.length === 0}>
            Compartir ventas
          </button>
          <button type="button" onClick={exportar} disabled={ventas.length === 0}>
            Exportar CSV
          </button>
        </div>
        {verResumen && totales && (
          <div className="resumen-detalle">
            <div className="metodo-fila"><span>Ventas</span><strong>{totales.cantidadVentas}</strong></div>
            {totales.porMetodo.map((m) => (
              <div className="metodo-fila" key={m.metodo}>
                <span>{m.metodo}</span>
                <strong>{formatearPesos(m.total)}</strong>
              </div>
            ))}
            {esAdmin && (
              <Link to={`/eventos/${eventoId}/gastos`} className="evento-chip">Gastos y ganancia →</Link>
            )}
          </div>
        )}
      </div>

      <h2>Productos</h2>
      {productos.length === 0 ? (
        <p className="venta-vacia">Aún no tienes productos. Agrégalos en “Catálogo”.</p>
      ) : (
        <ul className="venta-lista">
          {productos.map((producto) => {
            const cantidad = cantidades[producto.id] ?? 0;
            return (
              <li key={producto.id} aria-label={producto.nombre} className={`sel-fila${cantidad > 0 ? " activo" : ""}`}>
                <div className="prod-emoji">{producto.icono ?? "🛍️"}</div>
                <div className="sel-info">
                  <div className="sel-nombre">{producto.nombre}</div>
                  <div className="sel-precio">{formatearPesos(producto.precio)}</div>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => cambiarCantidad(producto.id, -1)}>−</button>
                  <span className="cant">{cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(producto.id, 1)}>+</button>
                </div>
                <span className="sel-subtotal">{formatearPesos(producto.precio * cantidad)}</span>
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
        {esEfectivo && (
          <>
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
          </>
        )}
        <button type="button" className="principal" onClick={registrar} disabled={calculo.total <= 0}>
          Registrar venta
        </button>
      </div>

      <h2>Ventas de hoy</h2>
      {ventasRecientes.length === 0 ? (
        <p className="venta-vacia">Aún no hay ventas registradas.</p>
      ) : (
        <ul className="ventas-hechas">
          {ventasRecientes.map((v) => (
            <li key={v.id || v.uuid} className="venta-hecha">
              <div className="vh-info">
                <strong className="vh-total">{formatearPesos(v.total)}</strong>
                <span className="vh-meta">
                  {v.metodoPagoNombre} · {hora(v.creadaEnDispositivo)}
                  {esAdmin && v.neto != null ? ` · neto ${formatearPesos(v.neto)}` : ""}
                </span>
              </div>
              <button type="button" className="vh-borrar" onClick={() => borrarVenta(v.id)} aria-label="Eliminar venta">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
