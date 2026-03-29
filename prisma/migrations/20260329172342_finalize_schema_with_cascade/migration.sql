-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "userUid" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Participant_userUid_fkey" FOREIGN KEY ("userUid") REFERENCES "User" ("firebaseUid") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("eventId", "id", "joinedAt", "userUid") SELECT "eventId", "id", "joinedAt", "userUid" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE INDEX "Participant_userUid_idx" ON "Participant"("userUid");
CREATE UNIQUE INDEX "Participant_eventId_userUid_key" ON "Participant"("eventId", "userUid");
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "activationEnergy" REAL NOT NULL DEFAULT 10.0,
    "payerUid" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_payerUid_fkey" FOREIGN KEY ("payerUid") REFERENCES "User" ("firebaseUid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("activationEnergy", "amount", "createdAt", "description", "eventId", "id", "payerUid") SELECT "activationEnergy", "amount", "createdAt", "description", "eventId", "id", "payerUid" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_eventId_idx" ON "Transaction"("eventId");
CREATE INDEX "Transaction_payerUid_idx" ON "Transaction"("payerUid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Event_creatorId_idx" ON "Event"("creatorId");

-- CreateIndex
CREATE INDEX "Friend_userUid_idx" ON "Friend"("userUid");

-- CreateIndex
CREATE INDEX "Friend_friendUid_idx" ON "Friend"("friendUid");
