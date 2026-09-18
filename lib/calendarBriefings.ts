import { GoogleCalendarEvent } from "./googleCalendar";
import { MicrosoftCalendarEvent } from "./microsoftGraph";

export type BriefingEvent = {
  provider: "microsoft" | "google";
  id: string;
  kind: "interview" | "important_meeting";
  title: string;
  start: string;
  end: string;
  organizer?: string;
  attendees: string[];
  location?: string;
  description?: string;
  webUrl?: string;
};

const interviewPattern = /\b(interview|recruiter|hiring manager|candidate|phone screen|screening call|technical screen|panel interview)\b/i;
const importantPattern = /\b(audit|customer|client|leadership|strategy|review|presentation|kickoff|planning|production|quality|supplier|performance|one[- ]on[- ]one|1:1|executive|director|vice president|vp)\b/i;

function clean(value: string | undefined, limit = 1_500) {
  return value?.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) || undefined;
}

function parseMicrosoftDate(value: string | undefined) {
  if (!value) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGoogleDate(value: { dateTime?: string; date?: string } | undefined) {
  const date = new Date(value?.dateTime || value?.date || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function kindFor(title: string, description: string, importance: string | undefined, attendeeCount: number) {
  const searchable = `${title} ${description}`;
  if (interviewPattern.test(searchable)) return "interview" as const;
  if (importance === "high" || importantPattern.test(searchable) || attendeeCount >= 4) return "important_meeting" as const;
  return null;
}

export function normalizeMicrosoftEvents(events: MicrosoftCalendarEvent[], now: Date) {
  const oneDay = now.getTime() + 24 * 60 * 60_000;
  return events.flatMap(event => {
    const start = parseMicrosoftDate(event.start?.dateTime); const end = parseMicrosoftDate(event.end?.dateTime);
    if (!start || !end || end <= now) return [];
    const title = clean(event.subject, 240) || "Untitled meeting";
    const description = clean(event.bodyPreview) || "";
    const kind = kindFor(title, description, event.importance, event.attendees?.length || 0);
    if (!kind || (kind === "important_meeting" && start.getTime() > oneDay)) return [];
    return [{
      provider: "microsoft" as const, id: event.id, kind, title, start: start.toISOString(), end: end.toISOString(),
      organizer: clean(event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address, 160),
      attendees: (event.attendees || []).map(item => clean(item.emailAddress?.name || item.emailAddress?.address, 160)).filter((item): item is string => Boolean(item)).slice(0, 12),
      location: clean(event.location?.displayName, 240), description: description || undefined, webUrl: event.webLink,
    } satisfies BriefingEvent];
  });
}

export function normalizeGoogleEvents(events: GoogleCalendarEvent[], now: Date) {
  const oneDay = now.getTime() + 24 * 60 * 60_000;
  return events.flatMap(event => {
    const start = parseGoogleDate(event.start); const end = parseGoogleDate(event.end);
    if (!start || !end || end <= now) return [];
    const title = clean(event.summary, 240) || "Untitled meeting";
    const description = clean(event.description) || "";
    const kind = kindFor(title, description, undefined, event.attendees?.length || 0);
    if (!kind || (kind === "important_meeting" && start.getTime() > oneDay)) return [];
    return [{
      provider: "google" as const, id: event.id, kind, title, start: start.toISOString(), end: end.toISOString(),
      organizer: clean(event.organizer?.displayName || event.organizer?.email, 160),
      attendees: (event.attendees || []).map(item => clean(item.displayName || item.email, 160)).filter((item): item is string => Boolean(item)).slice(0, 12),
      location: clean(event.location, 240), description: description || undefined, webUrl: event.htmlLink,
    } satisfies BriefingEvent];
  });
}
