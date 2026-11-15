-- Push notifications (Web Push / VAPID). Additive only: safe on live data.
ALTER TABLE "UserConfig" ADD COLUMN "vapidPublicKey" TEXT;
ALTER TABLE "UserConfig" ADD COLUMN "vapidPrivateKey" TEXT;
ALTER TABLE "UserConfig" ADD COLUMN "pushMeetings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserConfig" ADD COLUMN "pushUrgentEmails" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
