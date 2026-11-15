-- CreateTable
CREATE TABLE "UserConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "ownerName" TEXT NOT NULL DEFAULT 'Sir',
    "assistantName" TEXT NOT NULL DEFAULT 'J.A.R.V.I.S.',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "llmProvider" TEXT NOT NULL DEFAULT 'mock',
    "llmModel" TEXT NOT NULL DEFAULT '',
    "openaiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "geminiApiKey" TEXT,
    "voiceProvider" TEXT NOT NULL DEFAULT 'mock',
    "vapiApiKey" TEXT,
    "vapiPublicKey" TEXT,
    "vapiAssistantId" TEXT,
    "vapiPhoneNumberId" TEXT,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "twilioFromNumber" TEXT,
    "twilioVoice" TEXT NOT NULL DEFAULT 'Polly.Brian',
    "whatsappProvider" TEXT NOT NULL DEFAULT 'mock',
    "whatsappToken" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappVerifyToken" TEXT,
    "whatsappAppSecret" TEXT,
    "twilioWhatsappFrom" TEXT,
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "googleRefreshToken" TEXT,
    "googleEmail" TEXT,
    "googleCalendarId" TEXT NOT NULL DEFAULT 'primary',
    "n8nEnabled" BOOLEAN NOT NULL DEFAULT false,
    "n8nWebhooks" TEXT NOT NULL DEFAULT '{}',
    "n8nSecret" TEXT,
    "personalPhone" TEXT NOT NULL DEFAULT '',
    "callLeadMinutes" INTEGER NOT NULL DEFAULT 10,
    "callWindowMinutes" INTEGER NOT NULL DEFAULT 5,
    "autoCallMeetings" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '07:00',
    "quietAllowUrgent" BOOLEAN NOT NULL DEFAULT true,
    "urgentThreshold" INTEGER NOT NULL DEFAULT 9,
    "urgentAlertChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "emailScanMaxResults" INTEGER NOT NULL DEFAULT 20,
    "voiceName" TEXT NOT NULL DEFAULT '',
    "voiceRate" REAL NOT NULL DEFAULT 1.0,
    "voicePitch" REAL NOT NULL DEFAULT 0.9,
    "voiceLang" TEXT NOT NULL DEFAULT 'en-GB',
    "speakResponses" BOOLEAN NOT NULL DEFAULT true,
    "emailRules" TEXT NOT NULL DEFAULT '',
    "vipSenders" TEXT NOT NULL DEFAULT '',
    "importantKeywords" TEXT NOT NULL DEFAULT 'urgent, invoice, contract, interview, deadline, payment',
    "ignoreKeywords" TEXT NOT NULL DEFAULT 'newsletter, unsubscribe, promotion, sale, webinar',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nicknames" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gmailId" TEXT NOT NULL,
    "threadId" TEXT,
    "fromName" TEXT NOT NULL DEFAULT '',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "score" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'IGNORE',
    "reason" TEXT NOT NULL DEFAULT '',
    "receivedAt" DATETIME NOT NULL,
    "alerted" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MeetingReminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "location" TEXT,
    "meetLink" TEXT,
    "autoCall" BOOLEAN NOT NULL DEFAULT true,
    "callTriggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" DATETIME,
    "callRef" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerId" TEXT,
    "error" TEXT,
    "contactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'native',
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_gmailId_key" ON "EmailLog"("gmailId");

-- CreateIndex
CREATE INDEX "EmailLog_category_receivedAt_idx" ON "EmailLog"("category", "receivedAt");

-- CreateIndex
CREATE INDEX "MeetingReminder_startTime_idx" ON "MeetingReminder"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingReminder_eventId_startTime_key" ON "MeetingReminder"("eventId", "startTime");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_contactId_idx" ON "WhatsAppMessage"("contactId");

-- CreateIndex
CREATE INDEX "ActionLog_type_createdAt_idx" ON "ActionLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_createdAt_idx" ON "ActionLog"("createdAt");

