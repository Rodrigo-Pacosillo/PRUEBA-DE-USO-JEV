import {
  MODELO_JEV,
  decisionesResponseSchema,
  choiceCategoriaSchema,
  scoreSchema,
  noulSchema,
  type DecisionesResponse,
  type ChoiceCategoriaAnswer,
  type ScoreAnswer,
  type NoulAnswer,
} from "@/lib/validations/jev";

/**
 * Cliente de Jev vía OpenRouter. Se habla HTTP crudo a propósito: la Decisions
 * API no es un endpoint compatible con chat/completions, así que los SDKs de
 * OpenAI y OpenRouter no pueden consumirla.
 *
 * Docs: https://openrouter.ai/docs/api/api-reference/alphadecisions
 */

const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const TIMEOUT_MS = 8000;

/**
 * Umbrales de la política. Son un punto de partida, no un cabal: TypeSafe
 * calibra las probabilidades en agregado, así que el número correcto depende
 * de cuántos ejemplos rotulados tengas de tu propio contenido. Como la política
 * es pura y trabaja sobre la respuesta guardada, cambiarlos y re-jugar no
 * cuesta ni una llamada más.
 */
export const UMBRALES = {
  /** Por debajo de esta confianza no sabemos ni qué clase de texto es. */
  confianzaMinima: 0.8,
  /** Utilidad (escala 0-3) por debajo de la cual no vale la pena leerlo. */
  utilidadMinima: 1.5,
  /** A partir de acá el texto sí justifica el tiempo de una persona. */
  utilidadDestacada: 2,
} as const;

/**
 * "Qué es" este texto. La opción `sin_contenido` es explícita a propósito: sin
 * una salida, el modelo tiene que elegir algo aunque nada encaje.
 */
export const CRITERIOS_CATEGORIA = {
  queja:
    "Algo que no anda: un error, una falla, una molestia, o un problema con algo que el sitio ya hace.",
  sugerencia:
    "Algo que todavía no existe: la persona pide una función nueva, una mejora, o un cambio que le serviría.",
  comentario:
    "La persona opina sobre el sitio o saluda, sin denunciar nada roto ni pedir nada nuevo.",
  sin_contenido:
    "No dice nada concreto: insultos, letras al azar, emojis sueltos, o una palabra sin contexto que no deja entender qué quiere.",
} as const;

/**
 * "Cuánto vale" leerlo. Escala ordenada de 0 a 3: el nivel más pesado es el
 * primero. Cada nivel describe una situación concreta.
 */
export const NIVELES_UTILIDAD = [
  "No aporta nada. No se puede entender qué quiere: una palabra suelta, insultos, letras al azar o emojis.",
  "Aporta poco. Dice que le gustó o que le molestó, pero sin decir qué ni por qué. No hay nada concreto para trabajar.",
  "Aporta algo. Describe un problema o una idea, aunque sea en una frase y sin detalle.",
  "Aporta mucho. Describe un problema o una idea concreto, con contexto suficiente para que alguien pueda revisarlo y actuar.",
] as const;

/**
 * Los mismos niveles, pero en una palabra. Los textos largos de arriba están
 * escritos para que los lea el modelo, no una persona: son los `criteria` que
 * se le envían. Mostrarle a alguien que Jev le puso 96% a "Aporta algo.
 * Describe un problema o una idea, aunque sea en una frase y sin detalle" no
 * aporta nada: el número ya resume la oración entera.
 *
 * El índice tiene que coincidir con el de `NIVELES_UTILIDAD`; hay un test que
 * lo verifica para que agregar un nivel sin su etiqueta rompa la suite.
 */
export const ETIQUETAS_UTILIDAD = ["Nada", "Poco", "Algo", "Mucho"] as const;

/**
 * Jev lee los criteria al pie de la letra, así que van escritos como si le
 * explicaras el caso a alguien nuevo que entra al equipo.
 */
export const PREGUNTAS = {
  categoria: {
    type: "choice",
    instructions:
      "¿Qué clase de texto es `mensaje`? Decidí solo por lo que dice el texto, no por dónde fue escrito.",
    criteria: CRITERIOS_CATEGORIA,
  },
  utilidad: {
    type: "score",
    instructions: "¿Cuánto vale la pena que una persona lea `mensaje`?",
    criteria: [...NIVELES_UTILIDAD],
  },
  revision_humana: {
    type: "noul",
    instructions: "¿Hace falta que una persona lo revise antes de contestarlo?",
  },
} as const;

export const ESTADOS = [
  "pendiente",
  "clasificado",
  "revision",
  "ruido",
  "error",
] as const;
export type EstadoAnalisis = (typeof ESTADOS)[number];

/** Campos que el analisis escribe sobre la sugerencia. */
export type DatosAnalisis = {
  categoria: string | null;
  utilidad: number | null;
  coincideTipo: boolean | null;
  destacado: boolean;
  requiereRevision: boolean | null;
  confianza: number | null;
  estadoAnalisis: EstadoAnalisis;
  jevRequestId: string | null;
  jevCosto: number | null;
  jevCrudo: string | null;
};

type Respuestas = {
  categoria: ChoiceCategoriaAnswer;
  utilidad: ScoreAnswer;
  revision_humana: NoulAnswer;
};

function extraerRespuestas(respuesta: DecisionesResponse): Respuestas {
  return {
    categoria: choiceCategoriaSchema.parse(respuesta.answers.categoria),
    utilidad: scoreSchema.parse(respuesta.answers.utilidad),
    revision_humana: noulSchema.parse(respuesta.answers.revision_humana),
  };
}

function guardarRespuesta(respuesta: DecisionesResponse): Pick<
  DatosAnalisis,
  "jevRequestId" | "jevCosto" | "jevCrudo"
> {
  return {
    jevRequestId: respuesta.id ?? null,
    jevCosto: respuesta.usage?.cost ?? null,
    // La respuesta no incluye el state, asi que guardar la distribucion no
    // duplica los datos personales de la sugerencia.
    jevCrudo: JSON.stringify(respuesta),
  };
}

function sinClasificar(estadoAnalisis: EstadoAnalisis): DatosAnalisis {
  return {
    categoria: null,
    utilidad: null,
    coincideTipo: null,
    destacado: false,
    requiereRevision: null,
    confianza: null,
    estadoAnalisis,
    jevRequestId: null,
    jevCosto: null,
    jevCrudo: null,
  };
}

/** Falla la llamada: la sugerencia queda sin clasificar, nunca se descarta. */
export function analisisFallido(): DatosAnalisis {
  return sinClasificar("error");
}

/**
 * Reglas duras: lo que el código puede resolver sin leer el texto. Son
 * exactas y gratis, así que corren antes de gastar una llamada. Solo atrapan
 * el ruido mecánico; "horrible" o "asdkjhaskdjh" son juicios semánticos y
 * corresponden a Jev.
 */
export const LETRAS_DISTINTAS_MINIMAS = 4;

export function esRuidoDeterminista(mensaje: string): boolean {
  const letras = mensaje
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas de acentuación
    .replace(/[^a-z]/g, "");

  return new Set(letras).size < LETRAS_DISTINTAS_MINIMAS;
}

function evaluarRuidoDuro(): DatosAnalisis {
  // `sin_contenido` no es una opción del formulario, así que el tipo declarado
  // nunca coincide con lo detectado.
  return {
    ...sinClasificar("ruido"),
    categoria: "sin_contenido",
    coincideTipo: false,
  };
}

/**
 * Política pura: convierte la respuesta en la decisión de la aplicación. El
 * modelo aporta evidencia (probabilidades) y el umbral lo pone el código, que
 * es el que sabe cuánto le cuesta equivocarse.
 *
 * El orden importa: primero la confianza, porque si no sabemos ni qué clase
 * de texto es, tampoco podemos saber si es ruido.
 */
export function aplicarPolitica(
  respuesta: DecisionesResponse,
  tipoDeclarado: string
): DatosAnalisis {
  const { categoria, utilidad, revision_humana } = extraerRespuestas(respuesta);
  const confianzaBaja = categoria.confidence < UMBRALES.confianzaMinima;
  const esRuido =
    categoria.choice === "sin_contenido" ||
    utilidad.score < UMBRALES.utilidadMinima;
  const pideRevision = revision_humana.noul >= UMBRALES.confianzaMinima;

  const estadoAnalisis: EstadoAnalisis = confianzaBaja
    ? "revision"
    : esRuido
      ? "ruido"
      : pideRevision
        ? "revision"
        : "clasificado";

  return {
    categoria: categoria.choice,
    utilidad: utilidad.score,
    // Comparar el tipo declarado con el detectado es aritmética, no lenguaje:
    // va en código y no ocupa una pregunta.
    coincideTipo: categoria.choice === tipoDeclarado,
    destacado:
      estadoAnalisis === "clasificado" && utilidad.score >= UMBRALES.utilidadDestacada,
    requiereRevision: estadoAnalisis === "revision",
    confianza: categoria.confidence,
    estadoAnalisis,
    ...guardarRespuesta(respuesta),
  };
}

export async function consultarJev(state: unknown): Promise<DecisionesResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno OPENROUTER_API_KEY.");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO_JEV,
      state,
      questions: PREGUNTAS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // Nunca se registra el state: aca solo llega el error de la API.
    throw new Error(`OpenRouter respondió ${res.status}: ${await res.text()}`);
  }

  return decisionesResponseSchema.parse(await res.json());
}

/**
 * Analiza una sugerencia y devuelve los campos para persistir. Lanza si la API
 * falla o si la respuesta no cumple el contrato esperado.
 *
 * El `tipo` declarado no viaja en el state a propósito: mandarlo haría que el
 * modelo tienda a confirmarlo, y justamente lo que se busca es clasificar por
 * el contenido y no por lo que ticked la persona. Por eso `tipo` entra solo
 * como string: acá se usa unicamente para compararlo con la categoría
 * detectada, y la base no garantiza que sea uno de los del formulario.
 */
export async function analizarSugerencia(sugerencia: {
  mensaje: string;
  tipo: string;
}): Promise<DatosAnalisis> {
  if (esRuidoDeterminista(sugerencia.mensaje)) {
    return evaluarRuidoDuro();
  }

  const respuesta = await consultarJev({ mensaje: sugerencia.mensaje });

  return aplicarPolitica(respuesta, sugerencia.tipo);
}

/** Corre varias tareas sin abrir más de `limite` conexiones a la vez. */
export async function conLimite<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;

  async function trabajador() {
    while (siguiente < items.length) {
      const indice = siguiente++;
      resultados[indice] = await tarea(items[indice]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, trabajador)
  );

  return resultados;
}

export type Opcion = { etiqueta: string; probabilidad: number };

export type Distribucion = {
  pregunta: string;
  tipo: "choice" | "score" | "noul";
  /** Nivel con mas peso: la opcion que Jev eligio. */
  elegida: Opcion;
  /** Todas las opciones, de mayor a menor probabilidad. */
  opciones: Opcion[];
};

function opcionesOrdenadas(
  probabilidades: Record<string, number>,
  etiqueta: (clave: string) => string
): Opcion[] {
  return Object.entries(probabilidades)
    .map(([clave, probabilidad]) => ({
      etiqueta: etiqueta(clave),
      probabilidad,
    }))
    // El orden de las claves cambia entre llamadas, asi que se ordena por peso.
    .sort((a, b) => b.probabilidad - a.probabilidad);
}

/** El score se indexa desde "0"; si el indice no existe, se muestra la clave. */
function etiquetaNivel(clave: string): string {
  return ETIQUETAS_UTILIDAD[Number(clave)] ?? clave;
}

/**
 * Vuelve a leer la distribucion que quedo guardada en `jevCrudo` para poder
 * mostrarla. Es un JSON guardado por nosotros, pero se valida igual: si no
 * cumple el contrato se devuelve una lista vacia en vez de romper la pagina.
 */
export function leerDistribuciones(jevCrudo: string | null): Distribucion[] {
  if (!jevCrudo) return [];

  let datos: unknown;
  try {
    datos = JSON.parse(jevCrudo);
  } catch {
    return [];
  }

  const respuesta = decisionesResponseSchema.safeParse(datos);
  if (!respuesta.success) return [];

  return Object.entries(respuesta.data.answers).flatMap(
    ([pregunta, answer]): Distribucion[] => {
      switch (answer.type) {
        case "choice":
        case "score": {
          // El choice ya devuelve sus claves cortas (queja, sugerencia, ...).
          // El score devuelve el legend, que es el texto largo que se le mando
          // al modelo: para mostrar se usa la etiqueta corta del mismo indice.
          const opciones = opcionesOrdenadas(
            answer.probabilities,
            answer.type === "score" ? etiquetaNivel : (clave) => clave
          );
          const [elegida] = opciones;
          return elegida
            ? [{ pregunta, tipo: answer.type, elegida, opciones }]
            : [];
        }
        case "noul": {
          const elegida: Opcion = {
            etiqueta: "Sí requiere revisión",
            probabilidad: answer.noul,
          };
          return [{ pregunta, tipo: answer.type, elegida, opciones: [elegida] }];
        }
      }
    }
  );
}
