"use client";
import { MessageCircle, PhoneOutgoing } from "lucide-react";
import { Field, Section, Select, TextInput, Toggle } from "./ui";
import { TestButton } from "./TestButton";
import { PushSection } from "./PushSection";
import type { AdminCtx } from "./types";

export function AlertsTab({ ctx }: { ctx: AdminCtx }) {
  const { get, set, status } = ctx;
  const lead = get<number>("callLeadMinutes");
  const win = get<number>("callWindowMinutes");
  return (
    <div className="space-y-4">
      <PushSection ctx={ctx} />

      <Section title="Your Phone" description="Where Jarvis calls and WhatsApps you.">
        <Field label="Personal phone number" hint="International format, e.g. +447700900123">
          <TextInput value={get("personalPhone")} onChange={(e) => set("personalPhone", e.target.value)} inputMode="tel" placeholder="+15551234567" />
        </Field>
        <div />
        <TestButton type="call" label="Test outbound call" icon={PhoneOutgoing} disabled={!status.phone} />
        <TestButton type="whatsapp" label="Test WhatsApp message" icon={MessageCircle} disabled={!status.phone} />
        {!status.phone && <p className="text-xs text-amber-200/80 sm:col-span-2">Save a phone number to enable tests.</p>}
      </Section>

      <Section title="Meeting Reminders" description={`Jarvis alerts you (push notification, plus a call if a voice provider is set up) when a meeting starts within ${lead}–${lead + win} minutes. Checked every 5 minutes.`}>
        <Field label="Lead time (minutes)">
          <TextInput type="number" min={1} max={120} value={lead} onChange={(e) => set("callLeadMinutes", Number(e.target.value))} />
        </Field>
        <Field label="Window (minutes)" hint="Should be ≥ your cron interval (5) so no meeting is missed">
          <TextInput type="number" min={1} max={60} value={win} onChange={(e) => set("callWindowMinutes", Number(e.target.value))} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={get<boolean>("autoCallMeetings")} onChange={(v) => set("autoCallMeetings", v)} label="Remind me about new meetings by default" hint="You can still toggle each meeting on the HUD." />
        </div>
      </Section>

      <Section title="Urgent Email Alerts" description="Fired once per email whose AI score meets the threshold. Push notifications are controlled above.">
        <Field label={`Urgency threshold: ${get<number>("urgentThreshold")}/10`}>
          <input type="range" min={5} max={10} value={get<number>("urgentThreshold")} onChange={(e) => set("urgentThreshold", Number(e.target.value))} className="w-full accent-cyan-400" />
        </Field>
        <Field label="Also alert via">
          <Select
            value={get("urgentAlertChannel")}
            onChange={(e) => set("urgentAlertChannel", e.target.value)}
            options={[
              { value: "none", label: "Push notification only" },
              { value: "whatsapp", label: "WhatsApp message" },
              { value: "call", label: "Phone call" },
              { value: "both", label: "WhatsApp + phone call" },
            ]}
          />
        </Field>
      </Section>

      <Section title="Quiet Hours (Do Not Disturb)" description="No meeting calls during this window. Times are in your configured timezone.">
        <div className="sm:col-span-2">
          <Toggle checked={get<boolean>("quietHoursEnabled")} onChange={(v) => set("quietHoursEnabled", v)} label="Enable quiet hours" />
        </div>
        <Field label="From">
          <TextInput type="time" value={get("quietStart")} onChange={(e) => set("quietStart", e.target.value)} />
        </Field>
        <Field label="Until">
          <TextInput type="time" value={get("quietEnd")} onChange={(e) => set("quietEnd", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={get<boolean>("quietAllowUrgent")} onChange={(v) => set("quietAllowUrgent", v)} label="Let urgent email alerts through" hint="Emails scored at or above the threshold still alert you." />
        </div>
      </Section>
    </div>
  );
}
