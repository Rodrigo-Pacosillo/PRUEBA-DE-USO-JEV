-- RedefineTables
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
    "destacado" BOOLEAN,
    "requiereRevision" BOOLEAN,
    "confianza" REAL,
    "estadoAnalisis" TEXT NOT NULL DEFAULT 'pendiente',
    "jevRequestId" TEXT,
    "jevCosto" REAL,
    "jevCrudo" TEXT
);

-- Se conservan nombre, tipo, mensaje y fecha. El analisis anterior venía de
-- otro juego de preguntas (equipo / urgencia) que ya no existe, asi que se
-- descarta entero y las filas vuelven a "pendiente" para que el backfill las
-- reanalice con las preguntas actuales.
INSERT INTO "new_Sugerencia" ("id", "nombre", "tipo", "mensaje", "fecha")
SELECT "id", "nombre", "tipo", "mensaje", "fecha" FROM "Sugerencia";

DROP TABLE "Sugerencia";
ALTER TABLE "new_Sugerencia" RENAME TO "Sugerencia";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
