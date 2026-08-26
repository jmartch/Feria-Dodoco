export function Cargando({ que = "" }: { que?: string }) {
  return <p role="status">Cargando{que ? ` ${que}` : ""}…</p>;
}
