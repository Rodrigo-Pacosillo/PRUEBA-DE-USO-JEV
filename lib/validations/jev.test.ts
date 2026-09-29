import { describe, expect, it } from "vitest";
import {
  decisionesResponseSchema,
  choiceCategoriaSchema,
  scoreSchema,
  noulSchema,
  type DecisionesResponse,
  type ChoiceCategoriaAnswer,
  type NoulAnswer,
  type ScoreAnswer,
} from "@/lib/validations/jev";
import {
  aplicarPolitica,
  analisisFallido,
  esRuidoDeterminista,
  leerDistribuciones,
  NIVELES_UTILIDAD,
  ETIQUETAS_UTILIDAD,
  PREGUNTAS,
  UMBRALES,
} from "@/lib/jev";

/** Respuesta real de OpenRouter, recortada a lo que usa la aplicacion. */
const RESPUESTA: DecisionesResponse = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    categoria: {
      type: "choice",
      choice: "queja",
      probabilities: {
        queja: 0.82,
        sugerencia: 0.1,
        comentario: 0.05,
        sin_contenido: 0.03,
      },
      confidence: 0.82,
    },
    utilidad: {
      type: "score",
      score: 2.1,
      // Las claves arrancan en "0": indice del nivel.
      legend: {
        "0": "No aporta nada.",
        "1": "Aporta poco.",
        "2": "Aporta algo.",
        "3": "Aporta mucho.",
      },
      probabilities: { "0": 0.01, "1": 0.04, "2": 0.8, "3": 0.15 },
      confidence: 0.8,
    },
    revision_humana: { type: "noul", noul: 0.3 },
  },
  usage: { input_tokens: 447, output_tokens: 69, cost: 0.0000192 },
  id: "gen-dec-1790013867-chEjwDPvoiiffM3J3eDF",
  provider: "TypeSafe",
};

describe("decisionesResponseSchema", () => {
  it("parsea las tres formas de respuesta", () => {
    const respuesta = decisionesResponseSchema.parse(RESPUESTA);
    expect(respuesta.answers.categoria.type).toBe("choice");
    expect(respuesta.answers.utilidad.type).toBe("score");
    expect(respuesta.answers.revision_humana.type).toBe("noul");
  });

  it("deja los metadatos de la respuesta opcionales", () => {
    const respuesta = decisionesResponseSchema.parse({
      model: "typesafe/jev-1.13",
      answers: RESPUESTA.answers,
    });
    expect(respuesta.usage).toBeUndefined();
    expect(respuesta.id).toBeUndefined();
  });

  it("rechaza una confianza fuera de rango", () => {
    expect(() =>
      scoreSchema.parse({ ...RESPUESTA.answers.utilidad, confidence: 1.4 })
    ).toThrow();
  });

  it("rechaza una categoria fuera de las opciones declaradas", () => {
    expect(() =>
      choiceCategoriaSchema.parse({
        ...RESPUESTA.answers.categoria,
        choice: "diseño",
      })
    ).toThrow();
  });

  it("no le pone confidence a un noul", () => {
    // La probabilidad es toda la respuesta de un noul: no hay confianza aparte.
    const noul = noulSchema.parse({
      type: "noul",
      noul: 0.9,
      confidence: 0.9,
    });
    expect(noul).toEqual({ type: "noul", noul: 0.9 });
  });
});

describe("esRuidoDeterminista", () => {
  it("atrapa el ruido mecanico", () => {
    expect(esRuidoDeterminista("aaaa")).toBe(true);
    expect(esRuidoDeterminista("asd")).toBe(true);
    expect(esRuidoDeterminista("$%#")).toBe(true);
    expect(esRuidoDeterminista("ab")).toBe(true);
    expect(esRuidoDeterminista("hola!")).toBe(false);
  });

  it("deja pasar los mensajes de verdad", () => {
    expect(esRuidoDeterminista("hola")).toBe(false);
    expect(esRuidoDeterminista("no hay pan")).toBe(false);
  });

  it("no juzga el significado, solo cuenta letras distintas", () => {
    // Estas si son ruido, pero semanticamente: las decide Jev, no el codigo.
    expect(esRuidoDeterminista("horrible")).toBe(false);
    expect(esRuidoDeterminista("asdkjhaskdjh")).toBe(false);
  });
});

describe("aplicarPolitica", () => {
  /** Ajusta una sola respuesta y deja las demas como en la respuesta real. */
  function conAjuste(cambios: {
    categoria?: Partial<ChoiceCategoriaAnswer>;
    utilidad?: Partial<ScoreAnswer>;
    revisionHumana?: NoulAnswer;
  }): DecisionesResponse {
    return {
      ...RESPUESTA,
      answers: {
        categoria: {
          ...RESPUESTA.answers.categoria,
          ...cambios.categoria,
        } as ChoiceCategoriaAnswer,
        utilidad: {
          ...RESPUESTA.answers.utilidad,
          ...cambios.utilidad,
        } as ScoreAnswer,
        revision_humana:
          cambios.revisionHumana ?? RESPUESTA.answers.revision_humana,
      },
    } as DecisionesResponse;
  }

  it("clasifica cuando la confianza llega al umbral y hay contenido", () => {
    expect(
      aplicarPolitica(
        conAjuste({ categoria: { confidence: UMBRALES.confianzaMinima } }),
        "queja"
      )
    ).toMatchObject({
      categoria: "queja",
      utilidad: 2.1,
      coincideTipo: true,
      destacado: true,
      requiereRevision: false,
      confianza: UMBRALES.confianzaMinima,
      estadoAnalisis: "clasificado",
      jevRequestId: "gen-dec-1790013867-chEjwDPvoiiffM3J3eDF",
    });
  });

  it("manda a revision si la confianza queda abajo del umbral", () => {
    const datos = aplicarPolitica(
      conAjuste({ categoria: { confidence: UMBRALES.confianzaMinima - 0.02 } }),
      "queja"
    );

    expect(datos.confianza).toBeLessThan(UMBRALES.confianzaMinima);
    expect(datos.estadoAnalisis).toBe("revision");
    // Aunque el noul diga que no hace falta revision, la confianza manda.
    expect(datos.requiereRevision).toBe(true);
  });

  it("la confianza manda sobre el ruido", () => {
    // Con poca confianza ni siquiera se puede afirmar que sea ruido.
    const datos = aplicarPolitica(
      conAjuste({
        categoria: { confidence: 0.5, choice: "sin_contenido" },
      }),
      "queja"
    );
    expect(datos.estadoAnalisis).toBe("revision");
  });

  it("descarta lo que Jev marca como sin contenido", () => {
    const datos = aplicarPolitica(
      conAjuste({ categoria: { choice: "sin_contenido" } }),
      "queja"
    );
    expect(datos.estadoAnalisis).toBe("ruido");
    expect(datos.destacado).toBe(false);
  });

  it("descarta lo que esta por debajo del piso de utilidad", () => {
    const datos = aplicarPolitica(
      conAjuste({ utilidad: { score: UMBRALES.utilidadMinima - 0.1 } }),
      "queja"
    );
    expect(datos.estadoAnalisis).toBe("ruido");
  });

  it("pide revision cuando el noul supera el umbral", () => {
    const datos = aplicarPolitica(
      conAjuste({ revisionHumana: { type: "noul", noul: 0.9 } }),
      "queja"
    );
    expect(datos.estadoAnalisis).toBe("revision");
    expect(datos.requiereRevision).toBe(true);
    // El contenido sigue guardado: descartar la revision seria perder informacion.
    expect(datos.categoria).toBe("queja");
  });

  it("no destaca lo que no llega al piso de utilidad destacada", () => {
    const datos = aplicarPolitica(
      conAjuste({ utilidad: { score: UMBRALES.utilidadDestacada - 0.1 } }),
      "queja"
    );
    expect(datos.estadoAnalisis).toBe("clasificado");
    expect(datos.destacado).toBe(false);
  });

  it("detecta que el tipo declarado no calza con el detectado", () => {
    const datos = aplicarPolitica(conAjuste({}), "sugerencia");
    expect(datos.coincideTipo).toBe(false);
  });

  it("guarda el costo y la distribucion para poder mostrarla despues", () => {
    const datos = aplicarPolitica(conAjuste({}), "queja");
    expect(datos.jevCosto).toBe(0.0000192);
    expect(datos.jevCrudo).toContain('"choice":"queja"');
    // La respuesta guardada no incluye el state, asi que no duplica el mensaje.
    expect(datos.jevCrudo).not.toContain("mensaje");
  });
});

describe("analisisFallido", () => {
  it("deja la sugerencia sin clasificar en vez de perderla", () => {
    expect(analisisFallido()).toEqual({
      categoria: null,
      utilidad: null,
      coincideTipo: null,
      destacado: false,
      requiereRevision: null,
      confianza: null,
      estadoAnalisis: "error",
      jevRequestId: null,
      jevCosto: null,
      jevCrudo: null,
    });
  });
});

describe("las preguntas que se le mandan al modelo", () => {
  it("tiene una etiqueta corta por cada nivel de utilidad", () => {
    // Si se agrega un nivel a NIVELES_UTILIDAD y no su etiqueta, la pantalla
    // mostraría la clave del índice en vez de una palabra.
    expect(ETIQUETAS_UTILIDAD).toHaveLength(NIVELES_UTILIDAD.length);
  });

  it("los textos largos van al modelo, no a la pantalla", () => {
    // Lo que se envía son las frases completas: son las que hacen que el modelo
    // entienda cada nivel. Las cortas son solo para mostrar.
    expect(PREGUNTAS.utilidad.criteria).toEqual([...NIVELES_UTILIDAD]);
    expect(PREGUNTAS.utilidad.criteria[0]).toContain("letras al azar");
  });
});

describe("leerDistribuciones", () => {
  it("devuelve una lista vacia si no hay nada guardado", () => {
    expect(leerDistribuciones(null)).toEqual([]);
  });

  it("devuelve una lista vacia si el JSON guardado esta roto", () => {
    expect(leerDistribuciones("{no es json")).toEqual([]);
  });

  it("ordena las opciones de mayor a menor probabilidad", () => {
    const [categoria] = leerDistribuciones(JSON.stringify(RESPUESTA));
    expect(categoria.pregunta).toBe("categoria");
    expect(categoria.elegida.etiqueta).toBe("queja");
    expect(categoria.opciones.map((o) => o.probabilidad)).toEqual([
      0.82, 0.1, 0.05, 0.03,
    ]);
  });

  it("muestra el score con la etiqueta corta del nivel, no con el legend", () => {
    const utilidad = leerDistribuciones(JSON.stringify(RESPUESTA)).find(
      (d) => d.pregunta === "utilidad"
    );
    // El legend es la frase larga que se le mando al modelo; a una persona le
    // alcanza con la palabra del nivel y el porcentaje.
    expect(utilidad?.elegida.etiqueta).toBe("Algo");
    expect(utilidad?.opciones.map((o) => o.etiqueta)).toEqual([
      "Algo",
      "Mucho",
      "Poco",
      "Nada",
    ]);
  });

  it("cae a la clave cruda si el nivel no tiene etiqueta corta", () => {
    const conNivelInesperado = {
      ...RESPUESTA,
      answers: {
        ...RESPUESTA.answers,
        utilidad: {
          ...RESPUESTA.answers.utilidad,
          probabilities: { "0": 0.1, "7": 0.9 },
        },
      },
    } as DecisionesResponse;

    const utilidad = leerDistribuciones(
      JSON.stringify(conNivelInesperado)
    ).find((d) => d.pregunta === "utilidad");
    expect(utilidad?.elegida.etiqueta).toBe("7");
  });

  it("muestra el noul como una sola opcion", () => {
    const noul = leerDistribuciones(JSON.stringify(RESPUESTA)).find(
      (d) => d.pregunta === "revision_humana"
    );
    expect(noul?.tipo).toBe("noul");
    expect(noul?.opciones).toHaveLength(1);
    expect(noul?.elegida.probabilidad).toBe(0.3);
  });
});
