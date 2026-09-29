import { describe, expect, it, vi, afterEach } from "vitest";
import {
  analizarSugerencia,
  consultarJev,
  aplicarPolitica,
  conLimite,
  PREGUNTAS,
} from "@/lib/jev";
import { MODELO_JEV, type DecisionesResponse } from "@/lib/validations/jev";

const RESPUESTA_OPENROUTER = {
  model: "typesafe/jev-1.13-20260917",
  answers: {
    categoria: {
      type: "choice",
      choice: "queja",
      probabilities: {
        queja: 1,
        sugerencia: 0,
        comentario: 0,
        sin_contenido: 0,
      },
      confidence: 1,
    },
    utilidad: {
      type: "score",
      score: 2,
      legend: {
        "0": "No aporta nada.",
        "1": "Aporta poco.",
        "2": "Aporta algo.",
        "3": "Aporta mucho.",
      },
      probabilities: { "0": 0, "1": 0, "2": 1, "3": 0 },
      confidence: 1,
    },
    revision_humana: { type: "noul", noul: 0.82 },
  },
  usage: { input_tokens: 447, output_tokens: 69, cost: 0.000018774 },
  id: "gen-dec-1790013867-chEjwDPvoiiffM3J3eDF",
  provider: "TypeSafe",
};

function conApiKey(mock: () => Promise<Response>) {
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  const fetchMock = vi.fn(mock);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe("consultarJev contra la Decisions API", () => {
  it("manda el contrato que documenta OpenRouter", async () => {
    const fetchMock = conApiKey(async () =>
      Response.json(RESPUESTA_OPENROUTER)
    );

    await consultarJev({ mensaje: "me cobraron dos veces" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];

    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-or-test"
    );

    const cuerpo = JSON.parse(init.body as string);
    expect(cuerpo.model).toBe(MODELO_JEV);
    expect(Object.keys(cuerpo.questions)).toEqual(Object.keys(PREGUNTAS));
    // El tipo de cada pregunta tiene que ser el que la API acepta.
    expect(cuerpo.questions.categoria.type).toBe("choice");
    expect(cuerpo.questions.utilidad.type).toBe("score");
    expect(cuerpo.questions.revision_humana.type).toBe("noul");
    // El score necesita un array ordenado de 2 a 10 niveles.
    expect(Array.isArray(cuerpo.questions.utilidad.criteria)).toBe(true);
    expect(cuerpo.questions.utilidad.criteria).toHaveLength(4);
  });

  it("traduce la respuesta real a los campos de la sugerencia", async () => {
    conApiKey(async () => Response.json(RESPUESTA_OPENROUTER));

    const datos = aplicarPolitica(
      (await consultarJev({ mensaje: "x" })) as DecisionesResponse,
      "queja"
    );

    expect(datos).toMatchObject({
      categoria: "queja",
      utilidad: 2,
      confianza: 1,
      coincideTipo: true,
      // El noul del fixture pide revision, asi que no se destaca: destacar es
      // para lo que ya se puede leer solo.
      destacado: false,
      requiereRevision: true,
      estadoAnalisis: "revision",
      jevRequestId: "gen-dec-1790013867-chEjwDPvoiiffM3J3eDF",
    });
  });

  it("falla claro si falta la api key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(consultarJev({ mensaje: "x" })).rejects.toThrow(
      "Falta la variable de entorno OPENROUTER_API_KEY."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propaga el error si OpenRouter responde con otro status", async () => {
    conApiKey(async () => new Response("invalid api key", { status: 401 }));

    await expect(consultarJev({ mensaje: "x" })).rejects.toThrow(
      /OpenRouter respondió 401/
    );
  });

  it("rechaza una respuesta que no cumple el contrato", async () => {
    conApiKey(async () =>
      Response.json({
        model: "x",
        answers: { categoria: { type: "inventado" } },
      })
    );

    await expect(consultarJev({ mensaje: "x" })).rejects.toThrow();
  });
});

describe("analizarSugerencia", () => {
  it("no manda el tipo declarado: se clasifica por el contenido", async () => {
    const fetchMock = conApiKey(async () =>
      Response.json(RESPUESTA_OPENROUTER)
    );

    await analizarSugerencia({
      tipo: "comentario",
      mensaje: "me cobraron dos veces",
    });

    const cuerpo = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string
    );
    // Mandarlo seria meter la respuesta dentro del prompt.
    expect(cuerpo.state).toEqual({ mensaje: "me cobraron dos veces" });
    expect(JSON.stringify(cuerpo.state)).not.toContain("comentario");
  });

  it("resuelve el ruido mecanico sin gastar una llamada", async () => {
    const fetchMock = conApiKey(async () =>
      Response.json(RESPUESTA_OPENROUTER)
    );

    const datos = await analizarSugerencia({ tipo: "queja", mensaje: "aaaa" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(datos).toMatchObject({
      categoria: "sin_contenido",
      estadoAnalisis: "ruido",
      coincideTipo: false,
      destacado: false,
    });
  });
});

describe("conLimite", () => {
  it("respeta el tope de concurrencia", async () => {
    let enCurso = 0;
    let maximoVisto = 0;

    await conLimite([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      enCurso++;
      maximoVisto = Math.max(maximoVisto, enCurso);
      await new Promise((r) => setTimeout(r, 5));
      enCurso--;
      return n * 2;
    });

    expect(maximoVisto).toBeLessThanOrEqual(3);
  });

  it("devuelve los resultados en el orden de entrada", async () => {
    const resultados = await conLimite([3, 1, 2], 2, async (n) => {
      await new Promise((r) => setTimeout(r, n));
      return n;
    });
    expect(resultados).toEqual([3, 1, 2]);
  });

  it("no explota si hay mas limite que elementos", async () => {
    const resultados = await conLimite([1, 2], 10, async (n) => n);
    expect(resultados).toEqual([1, 2]);
  });
});
