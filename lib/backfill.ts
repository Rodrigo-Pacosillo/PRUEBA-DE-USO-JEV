/**
 * Estado del backfill, en un modulo aparte de `actions.ts` porque los archivos
 * con "use server" solo pueden exportar funciones async. Los tipos no tienen
 * ese problema, pero los valores (este estado inicial y el tope por lote) si.
 */

/** Cuantas filas clasifica un clic del backfill, para no colgarse. */
export const MAXIMO_POR_LOTE = 25;

export type BackfillState = {
  analizadas: number;
  costo: number;
  restantes: number;
  error?: string;
};

export const initialBackfillState: BackfillState = {
  analizadas: 0,
  costo: 0,
  restantes: 0,
};
