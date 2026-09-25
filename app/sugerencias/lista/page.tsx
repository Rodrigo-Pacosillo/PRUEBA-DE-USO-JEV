import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ListaSugerenciasPage() {
  const sugerencias = await prisma.sugerencia.findMany({
    orderBy: { fecha: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Sugerencias recibidas
      </h1>
      {sugerencias.length === 0 ? (
        <p className="mt-6 text-zinc-600">Todavía no hay sugerencias.</p>
      ) : (
        <ul className="mt-6 flex w-full max-w-lg flex-col gap-4">
          {sugerencias.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold">{s.nombre}</p>
                <span className="text-xs text-zinc-500">{s.tipo}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{s.mensaje}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}