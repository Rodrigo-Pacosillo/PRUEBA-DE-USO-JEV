import AnalisisJev from "@/components/AnalisisJev";
import BotonAnalizarPendientes from "@/components/BotonAnalizarPendientes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * El modelo marca, no decide. Lo que el sistema considera poco relevante se
 * sigue mostrando: ocultarlo seria tirar abajo algo que una persona envió, y
 * ademas escondería los casos en los que la clasificación se equivoca.
 */
const MARCO_RUIDO = "border-red-300 bg-red-50";

export default async function ListaSugerenciasPage() {
  const sugerencias = await prisma.sugerencia.findMany({
    // Feed cronológico: lo más reciente arriba. La priorización la hace la
    // persona, con ayuda de las pills; el orden anterior obligaba a scrollear
    // hasta el final para encontrar el ruido.    orderBy: { fecha: "desc" },
  });

  const [paraRevision, destacadas, pendientes] = await Promise.all([
    prisma.sugerencia.count({ where: { estadoAnalisis: "revision" } }),
    prisma.sugerencia.count({ where: { destacado: true } }),
    prisma.sugerencia.count({
      where: { estadoAnalisis: { in: ["pendiente", "error"] } },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Sugerencias recibidas
      </h1>

      {paraRevision + destacadas > 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          {paraRevision} para tu revisión
          {destacadas > 0 ? ` · ${destacadas} destacadas` : ""}
        </p>
      ) : null}

      <BotonAnalizarPendientes pendientes={pendientes} />

      {sugerencias.length === 0 ? (
        <p className="mt-6 text-zinc-600">Todavía no hay sugerencias.</p>
      ) : (
        <ul className="mt-6 flex w-full max-w-lg flex-col gap-4">
          {sugerencias.map((s) => (
            <li
              key={s.id}
              className={`rounded-lg border p-4 ${
                s.estadoAnalisis === "ruido" ? MARCO_RUIDO : "border-zinc-200"
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold">{s.nombre}</p>
                <span className="text-xs text-zinc-500">{s.tipo}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{s.mensaje}</p>
              <AnalisisJev
                tipo={s.tipo}
                categoria={s.categoria}
                utilidad={s.utilidad}
                coincideTipo={s.coincideTipo}
                destacado={s.destacado}
                requiereRevision={s.requiereRevision}
                confianza={s.confianza}
                estadoAnalisis={s.estadoAnalisis}
                jevCrudo={s.jevCrudo}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
