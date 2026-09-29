import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Base aislada: este test comprueba que el analisis se persiste sin perder
// campos, y no debe tocar los datos de desarrollo.
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "jev-persistencia-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;

  const { execSync } = await import("node:child_process");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "ignore",
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("persistencia del analisis", () => {
  it("guarda todos los campos que devuelve la politica", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { analizarSugerencia, aplicarPolitica } = await import("@/lib/jev");

    // Camino 1: la regla dura, que no necesita API.
    const sugerencia = await prisma.sugerencia.create({
      data: { nombre: "Ana", tipo: "queja", mensaje: "aaaa" },
    });
    const datos = await analizarSugerencia({ tipo: sugerencia.tipo, mensaje: "aaaa" });
    // Si alguna clave no existiera como columna, Prisma fallaria acá.
    const guardada = await prisma.sugerencia.update({
      where: { id: sugerencia.id },
      data: datos,
    });

    expect(guardada.estadoAnalisis).toBe("ruido");
    expect(guardada.categoria).toBe("sin_contenido");
    expect(guardada.destacado).toBe(false);
    expect(guardada.coincideTipo).toBe(false);
    expect(guardada.utilidad).toBeNull();

    // Camino 2: una respuesta completa de Jev.
    const respuesta = {
      model: "typesafe/jev-1.13",
      id: "gen-dec-1",
      usage: { input_tokens: 1, output_tokens: 1, cost: 0.000019 },
      answers: {
        categoria: {
          type: "choice",
          choice: "sugerencia",
          probabilities: { queja: 0, sugerencia: 0.95, comentario: 0.05, sin_contenido: 0 },
          confidence: 0.95,
        },
        utilidad: {
          type: "score",
          score: 2.6,
          legend: { "0": "nada", "1": "poco", "2": "algo", "3": "mucho" },
          probabilities: { "0": 0, "1": 0.05, "2": 0.6, "3": 0.35 },
          confidence: 0.6,
        },
        revision_humana: { type: "noul", noul: 0.2 },
      },
    } as never;

    const completa = await prisma.sugerencia.update({
      where: { id: sugerencia.id },
      data: aplicarPolitica(respuesta, "comentario"),
    });

    expect(completa).toMatchObject({
      estadoAnalisis: "clasificado",
      categoria: "sugerencia",
      utilidad: 2.6,
      coincideTipo: false,
      destacado: true,
      requiereRevision: false,
      confianza: 0.95,
      jevRequestId: "gen-dec-1",
      jevCosto: 0.000019,
    });
    expect(completa.jevCrudo).toContain('"choice":"sugerencia"');
  });
});
