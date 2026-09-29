import { z } from "zod";

export const TIPOS = ["queja", "comentario", "sugerencia"] as const;

export const sugerenciaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(50, "El nombre no puede superar los 50 caracteres."),
  tipo: z.enum(TIPOS, {
    error: "Elegí un tipo válido.",
  }),
  mensaje: z
    .string()
    .trim()
    .min(10, "Contanos un poco más (mínimo 10 caracteres).")
    .max(500, "El mensaje no puede superar los 500 caracteres."),
});

export type SugerenciaInput = z.infer<typeof sugerenciaSchema>;
