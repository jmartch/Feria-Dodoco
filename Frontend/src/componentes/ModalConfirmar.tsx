import { useEffect } from "react";

type Props = {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/**
 * Modal de confirmación para acciones difíciles de deshacer (reiniciar o
 * eliminar una feria). Explica qué va a pasar y exige un "sí" explícito.
 */
export function ModalConfirmar({ titulo, mensaje, textoConfirmar, peligro, onConfirmar, onCancelar }: Props) {
  useEffect(() => {
    function alTecla(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [onCancelar]);

  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-label={titulo} onClick={onCancelar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        <p>{mensaje}</p>
        <div className="modal-acciones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="button" className={peligro ? "peligro" : "principal"} onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
