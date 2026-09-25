"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type SugerenciaFormState =
  | { success: true; message: string }
  | { success: false; error: string };

export async function crearSugerencia(
  _estado: SugerenciaFormState,
  formData: FormData
): Promise<SugerenciaFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "").trim();

  if (!nombre || !tipo || !mensaje) {
    return { success: false, error: "Completá todos los campos." };
  }

  try {
    await prisma.sugerencia.create({
      data: { nombre, tipo, mensaje },
    });
  } catch (error) {
    console.error("Error al guardar la sugerencia:", error);
    return {
      success: false,
      error: `No se pudo guardar: ${(error as Error).message}`,
    };
  }

  revalidatePath("/sugerencias/lista");
  redirect("/sugerencias/lista");
}