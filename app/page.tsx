import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Bienvenido a Mis Sugerencias
      </h1>
      <p className="max-w-md text-lg text-zinc-600">
        Este es el sitio para dejar quejas, comentarios y sugerencias.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sugerencias"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-white transition hover:bg-zinc-700"
        >
          Dejar una sugerencia
        </Link>
        <Link
          href="/sugerencias/lista"
          className="rounded-full border border-zinc-300 px-5 py-2.5 transition hover:bg-zinc-100"
        >
          Ver sugerencias
        </Link>
      </div>
    </div>
  );
}