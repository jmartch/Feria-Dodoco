import { formatearPesos } from "../dinero/formato";

export function BarraMeta({ bruto, meta }: { bruto: number; meta: number }) {
  const porcentaje = meta > 0 ? Math.min(100, Math.round((bruto / meta) * 100)) : 0;
  return (
    <div className="meta">
      <div
        className="meta-pista"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={bruto}
        aria-label="Progreso hacia la meta"
      >
        <div className="meta-relleno" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="meta-texto">
        <strong>{formatearPesos(bruto)}</strong> de {formatearPesos(meta)} ({porcentaje}%)
      </p>
    </div>
  );
}
