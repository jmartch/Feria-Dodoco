import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { crearApiCatalogo } from "../api/catalogo";
import type { MetodoPago } from "../api/tipos";
import { Cargando } from "../componentes/Cargando";
import { Empleados } from "../componentes/Empleados";

// La comisión se guarda en puntos básicos enteros: 150 = 1,5 %.
function comisionTexto(comisionPct: number) {
  if (comisionPct === 0) return "sin comisión";
  return `${(comisionPct / 100).toString().replace(".", ",")} % de comisión`;
}

export function Configuracion() {
  const { cliente } = useAuth();
  const api = useMemo(() => crearApiCatalogo(cliente), [cliente]);
  const [metodos, setMetodos] = useState<MetodoPago[] | null>(null);

  useEffect(() => {
    api.listarMetodos().then(setMetodos);
  }, [api]);

  if (!metodos) return <Cargando que="la configuración" />;

  return (
    <section>
      <h1>Configuración</h1>

      <h2>Métodos de pago</h2>
      <p className="nota">Vienen listos con la tienda. Efectivo es el que aparece por defecto al cobrar.</p>
      <ul>
        {metodos.map((m) => (
          <li key={m.id}>
            <div className="sel-info">
              <div className="sel-nombre">{m.nombre}</div>
              <div className="sel-precio">{comisionTexto(m.comisionPct)}</div>
            </div>
          </li>
        ))}
      </ul>

      <Empleados />
    </section>
  );
}
