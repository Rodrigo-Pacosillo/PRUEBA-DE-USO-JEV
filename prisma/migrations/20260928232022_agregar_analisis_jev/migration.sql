-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sugerencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipo" TEXT,
    "urgencia" REAL,
    "requiereRevision" BOOLEAN,
    "confianza" REAL,
    "estadoAnalisis" TEXT NOT NULL DEFAULT 'pendiente',
    "jevRequestId" TEXT,
    "jevCrudo" TEXT
);
INSERT INTO "new_Sugerencia" ("fecha", "id", "mensaje", "nombre", "tipo") SELECT "fecha", "id", "mensaje", "nombre", "tipo" FROM "Sugerencia";
DROP TABLE "Sugerencia";
ALTER TABLE "new_Sugerencia" RENAME TO "Sugerencia";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
