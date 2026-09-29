-- RedefineTables
-- "destacado" no es un dato que alguien escriba: lo deriva el analisis. Dejarlo
-- nullable haria que NULL significara dos cosas ("nunca analizado" y "no
-- destacada") y que un where: { destacado: null } filtrara por error.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sugerencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" TEXT,
    "utilidad" REAL,
    "coincideTipo" BOOLEAN,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "requiereRevision" BOOLEAN,
    "confianza" REAL,
    "estadoAnalisis" TEXT NOT NULL DEFAULT 'pendiente',
    "jevRequestId" TEXT,
    "jevCosto" REAL,
    "jevCrudo" TEXT
);

INSERT INTO "new_Sugerencia" (
    "id", "nombre", "tipo", "mensaje", "fecha", "categoria", "utilidad",
    "coincideTipo", "destacado", "requiereRevision", "confianza",
    "estadoAnalisis", "jevRequestId", "jevCosto", "jevCrudo"
)
SELECT
    "id", "nombre", "tipo", "mensaje", "fecha", "categoria", "utilidad",
    "coincideTipo", COALESCE("destacado", false), "requiereRevision", "confianza",
    "estadoAnalisis", "jevRequestId", "jevCosto", "jevCrudo"
FROM "Sugerencia";

DROP TABLE "Sugerencia";
ALTER TABLE "new_Sugerencia" RENAME TO "Sugerencia";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
