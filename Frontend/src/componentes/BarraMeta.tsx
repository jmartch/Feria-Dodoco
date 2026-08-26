import { formatearPesos } from "../dinero/formato";

export function BarraMeta({ bruto, meta }: { bruto: number; meta: number }) {
  const porcentaje = meta > 0 ? Math.min(100, Math.round((bruto / meta) * 100)) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={bruto}
        aria-label="Progreso hacia la meta"
      >
        <div style={{ width: `${porcentaje}%`, height: "1rem", background: "currentColor" }} />
      </div>
      <p>
        {formatearPesos(bruto)} de {formatearPesos(meta)} ({porcentaje}%)
      </p>
    </div>
  );
}
