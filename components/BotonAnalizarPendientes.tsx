"use client";

import { useActionState } from "react";
import { analizarPendientes } from "@/app/sugerencias/actions";
import {
  initialBackfillState,
  MAXIMO_POR_LOTE,
} from "@/lib/backfill";

export default function BotonAnalizarPendientes({
  pendientes,
}: {
  pendientes: number;
}) {
  // El conteo inicial viene del servidor: si no, el boton arrancaria oculto
  // con cero pendientes y nunca se podria disparar el primer lote.
  const [estado, accion, enCurso] = useActionState(analizarPendientes, {
    ...initialBackfillState,
    restantes: pendientes,
  });

  if (estado.restantes === 0 && !enCurso) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <form action={accion}>
        <button
          type="submit"
          disabled={enCurso}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enCurso
            ? "Analizando…"
            : `Analizar ${Math.min(estado.restantes, MAXIMO_POR_LOTE)} pendientes`}
        </button>
      </form>

      {estado.error ? (
        <p className="text-sm text-red-700">{estado.error}</p>
      ) : null}

      {estado.analizadas > 0 && !enCurso ? (
        <p className="text-xs text-zinc-500">
          {estado.analizadas} analizadas
          {estado.restantes > 0
            ? ` · quedan ${estado.restantes}`
            : " · no queda ninguna"}
          {estado.costo > 0 ? ` · $${estado.costo.toFixed(6)} en Jev` : ""}
        </p>
      ) : null}
    </div>
  );
}
