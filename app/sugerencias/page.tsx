"use client";

import { useActionState } from "react";
import { TIPOS } from "@/lib/validations/sugerencia";
import { crearSugerencia, type SugerenciaFormState } from "./actions";

const initialState: SugerenciaFormState = { success: false, errors: {} };

export default function SugerenciasPage() {
  const [state, formAction, pending] = useActionState(
    crearSugerencia,
    initialState
  );

  const errores = state.success ? {} : state.errors;

  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900";
  const errorClass = "mt-1 text-sm text-red-600";

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
          {errores.nombre?.[0] ? (
            <span className={errorClass}>{errores.nombre[0]}</span>
          ) : null}
        </label>

        <label className="text-sm font-medium">
          Tipo
          <select name="tipo" defaultValue="sugerencia" className={inputClass}>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo[0].toUpperCase() + tipo.slice(1)}
              </option>
            ))}
          </select>
          {errores.tipo?.[0] ? (
            <span className={errorClass}>{errores.tipo[0]}</span>
          ) : null}
        </label>

        <label className="text-sm font-medium">
          Mensaje
          <textarea
            name="mensaje"
            rows={4}
            placeholder="Escribí acá..."
            className={inputClass}
          />
          {errores.mensaje?.[0] ? (
            <span className={errorClass}>{errores.mensaje[0]}</span>
          ) : null}
        </label>

        {!state.success && state.error ? (
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
