"use client";

import { useActionState } from "react";
import { crearSugerencia, type SugerenciaFormState } from "./actions";

const initialState: SugerenciaFormState = { success: false, error: "" };

export default function SugerenciasPage() {
  const [state, formAction, pending] = useActionState(
    crearSugerencia,
    initialState
  );

  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900";

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Dejá tu sugerencia
      </h1>
      <p className="mt-2 text-center text-zinc-600">
        Contanos tu queja, comentario o sugerencia.
      </p>

      <form action={formAction} className="mt-8 flex w-full max-w-md flex-col gap-4">
        <label className="text-sm font-medium">
          Nombre
          <input name="nombre" placeholder="Tu nombre" className={inputClass} />
        </label>

        <label className="text-sm font-medium">
          Tipo
          <select name="tipo" defaultValue="sugerencia" className={inputClass}>
            <option value="queja">Queja</option>
            <option value="comentario">Comentario</option>
            <option value="sugerencia">Sugerencia</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          Mensaje
          <textarea
            name="mensaje"
            rows={4}
            placeholder="Escribí acá..."
            className={inputClass}
          />
        </label>

        {state.success === false && state.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}