import { z } from "zod";

/**
 * Contrato de la Decisions API de OpenRouter (POST /api/alpha/decisions).
 * Jev no genera texto: cada pregunta vuelve con una forma fija segun su tipo,
 * por eso el union es discriminado por `type` y no por los campos sueltos.
 *
 * Docs: https://openrouter.ai/docs/api/api-reference/alphadecisions
 */

export const MODELO_JEV = "typesafe/jev-1.13";

export const CATEGORIAS = ["queja", "sugerencia", "comentario", "sin_contenido"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

const probabilidad = z.number().min(0).max(1);

/** El nombre del campo viene en ingles: es el contrato de la API. */
const probabilities = z.record(z.string(), probabilidad);

export const choiceSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities,
  // Que tan concentrada esta la distribucion, no si la respuesta es correcta.
  confidence: probabilidad,
});

export const scoreSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  // Las claves arrancan en "0": indice del nivel dentro del array de criteria.
  legend: z.record(z.string(), z.string()),
  probabilities,
  confidence: probabilidad,
});

export const noulSchema = z.object({
  type: z.literal("noul"),
  // Un Noul no tiene `confidence`: la probabilidad es toda la respuesta.
  noul: probabilidad,
});

export const answerSchema = z.discriminatedUnion("type", [
  choiceSchema,
  scoreSchema,
  noulSchema,
]);

/**
 * La pregunta de categorias tiene sus propias opciones, asi que la respuesta
 * se valida contra ellas: si el modelo devolviera algo fuera del conjunto, la
 * sugerencia queda en estado "error" en vez de guardarse una categoria inválida.
 */
export const choiceCategoriaSchema = choiceSchema.extend({
  choice: z.enum(CATEGORIAS),
});

export const decisionesResponseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), answerSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
  id: z.string().optional(),
  provider: z.string().optional(),
});

export type DecisionesResponse = z.infer<typeof decisionesResponseSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type ChoiceAnswer = z.infer<typeof choiceSchema>;
export type ChoiceCategoriaAnswer = z.infer<typeof choiceCategoriaSchema>;
export type ScoreAnswer = z.infer<typeof scoreSchema>;
export type NoulAnswer = z.infer<typeof noulSchema>;
