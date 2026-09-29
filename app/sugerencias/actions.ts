"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  analizarSugerencia,
  analisisFallido,
  conLimite,
  type DatosAnalisis,
} from "@/lib/jev";
import {
  sugerenciaSchema,
  type SugerenciaInput,
} from "@/lib/validations/sugerencia";
import { MAXIMO_POR_LOTE, type BackfillState } from "@/lib/backfill";

type ErroresSugerencia = Partial<Record<keyof SugerenciaInput, string[]>>;

export type SugerenciaFormState =
  | { success: true; message: string }
  | { success: false; errors: ErroresSugerencia; error?: string };

const CONCURRENCIA = 5;

/**
 * Clasifica las sugerencias que todavia no pasaron por Jev. Va con concurrencia
 * limitada para no comerse el rate limit de OpenRouter, y con un tope por
 * lote: una server action tiene timeout, asi que pasar miles de filas es
 * trabajo de un job con cola, no de un clic.
 */
// useActionState la invoca como accion(estadoAnterior, formData); la accion no
// necesita leer ninguno de los dos.
export async function analizarPendientes(): Promise<BackfillState> {
  const pendientes = await prisma.sugerencia.findMany({
    where: { estadoAnalisis: { in: ["pendiente", "error"] } },
    orderBy: { id: "asc" },
    take: MAXIMO_POR_LOTE,
    select: { id: true, nombre: true, tipo: true, mensaje: true },
  });

  if (pendientes.length === 0) {
    return { analizadas: 0, costo: 0, restantes: 0 };
  }

  await conLimite(pendientes, CONCURRENCIA, async (fila) => {
    let analisis: DatosAnalisis;
    try {
      analisis = await analizarSugerencia(fila);
    } catch (error) {
      console.error(`Error al analizar la sugerencia ${fila.id}:`, error);
      analisis = analisisFallido();
    }

    await prisma.sugerencia.update({ where: { id: fila.id }, data: analisis });
  });

  const restantes = await prisma.sugerencia.count({
    where: { estadoAnalisis: { in: ["pendiente", "error"] } },
  });

  const costo = await prisma.sugerencia.aggregate({
    _sum: { jevCosto: true },
  });

  revalidatePath("/sugerencias/lista");

  return {
    analizadas: pendientes.length,
    costo: costo._sum.jevCosto ?? 0,
    restantes,
  };
}

export async function crearSugerencia(
  _estado: SugerenciaFormState,
  formData: FormData
): Promise<SugerenciaFormState> {
  const parsed = sugerenciaSchema.safeParse({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    mensaje: formData.get("mensaje"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  let id: number;
  try {
    const creada = await prisma.sugerencia.create({ data: parsed.data });
    id = creada.id;
  } catch (error) {
    console.error("Error al guardar la sugerencia:", error);
    return {
      success: false,
      errors: {},
      error: "No se pudo guardar la sugerencia.",
    };
  }

  // La sugerencia ya esta en la base: si Jev falla no se pierde nada, queda
  // sin clasificar a la espera de que alguien la revise.
  let analisis: DatosAnalisis;
  try {
    analisis = await analizarSugerencia(parsed.data);
  } catch (error) {
    console.error("Error al analizar con Jev:", error);
    analisis = analisisFallido();
  }

  await prisma.sugerencia.update({
    where: { id },
    data: analisis,
  });

  revalidatePath("/sugerencias/lista");
  redirect("/sugerencias/lista");
}
