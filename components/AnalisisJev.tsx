import { leerDistribuciones } from "@/lib/jev";

type Props = {
  tipo: string;
  categoria: string | null;
  utilidad: number | null;
  coincideTipo: boolean | null;
  destacado: boolean;
  requiereRevision: boolean | null;
  confianza: number | null;
  estadoAnalisis: string;
  jevCrudo: string | null;
};

const ESTADOS: Record<string, { etiqueta: string; clase: string }> = {
  clasificado: { etiqueta: "Clasificado", clase: "bg-zinc-100 text-zinc-700" },
  revision: { etiqueta: "Revisión manual", clase: "bg-amber-100 text-amber-900" },
  // "Descartada" mentia: nada se descarta, la fila sigue visible con un marco
  // en la lista. La etiqueta nombra la categoria, no una accion.
  ruido: { etiqueta: "Poco relevante", clase: "bg-red-100 text-red-800" },
  error: { etiqueta: "Sin clasificar", clase: "bg-red-100 text-red-800" },
  pendiente: { etiqueta: "Sin analizar", clase: "bg-zinc-100 text-zinc-500" },
};

const pill = "rounded-full px-2 py-0.5 text-xs font-medium";

function capitalizar(valor: string) {
  return valor[0].toUpperCase() + valor.slice(1).replace(/_/g, " ");
}

export default function AnalisisJev({
  tipo,
  categoria,
  utilidad,
  coincideTipo,
  destacado,
  requiereRevision,
  confianza,
  estadoAnalisis,
  jevCrudo,
}: Props) {
  const estado = ESTADOS[estadoAnalisis] ?? ESTADOS.pendiente;
  const distribuciones = leerDistribuciones(jevCrudo);
  const noCoincide = coincideTipo === false;

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${pill} ${estado.clase}`}>{estado.etiqueta}</span>

        {categoria ? (
          <span className={`${pill} bg-zinc-100 text-zinc-700`}>
            {capitalizar(categoria)}
          </span>
        ) : null}

        {/* El tipo del formulario se compara con el detectado: si no coinciden,
            la persona llenó el desplegable en falso y eso mismo es información. */}
        {noCoincide ? (
          <span className={`${pill} bg-sky-100 text-sky-900`}>
            {`Dijo “${capitalizar(tipo)}”`}
          </span>
        ) : null}

        {destacado ? (
          <span className={`${pill} bg-emerald-100 text-emerald-900`}>
            Destacada
          </span>
        ) : null}

        {utilidad !== null ? (
          <span className={`${pill} bg-zinc-100 text-zinc-700`}>
            Utilidad {utilidad.toFixed(2)}
          </span>
        ) : null}

        {requiereRevision && estadoAnalisis === "clasificado" ? (
          <span className={`${pill} bg-amber-100 text-amber-900`}>
            Pide revisión
          </span>
        ) : null}

        {confianza !== null ? (
          <span className="text-xs text-zinc-500">
            confianza {(confianza * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>

      {confianza !== null ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-zinc-800"
            style={{ width: `${Math.round(confianza * 100)}%` }}
          />
        </div>
      ) : null}

      {distribuciones.length > 0 ? (
        <details className="mt-3 text-xs text-zinc-600">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-800">
            Ver probabilidades
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {distribuciones.map((d) => (
              <div key={d.pregunta}>
                <p className="capitalize">{d.pregunta.replace(/_/g, " ")}</p>
                {/* Etiqueta y porcentaje en una sola linea: el desglose va con
                   etiquetas cortas justamente para que entre sin cortar. */}
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {d.opciones.map((o) => (
                    <li key={o.etiqueta} className="whitespace-nowrap">
                      {o.etiqueta}{" "}
                      <span className="tabular-nums text-zinc-500">
                        {(o.probabilidad * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
