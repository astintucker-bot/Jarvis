export type InterviewPhase = "game_plan" | "mock_interview" | "leadership_readiness" | "final_warmup" | "debrief";

type InterviewConfig = {
  role: string;
  interviewer: string;
  start: Date;
  end: Date;
  timeZone: string;
  prepDays: number;
  background: string;
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 14 ? parsed : fallback;
}

export function getInterviewConfig(): InterviewConfig | null {
  const role = process.env.JARVIS_INTERVIEW_ROLE?.trim();
  const interviewer = process.env.JARVIS_INTERVIEW_INTERVIEWER?.trim();
  const start = new Date(process.env.JARVIS_INTERVIEW_START || "");
  const end = new Date(process.env.JARVIS_INTERVIEW_END || "");
  if (!role || !interviewer || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return {
    role,
    interviewer,
    start,
    end,
    timeZone: process.env.JARVIS_INTERVIEW_TIME_ZONE?.trim() || "America/New_York",
    prepDays: parsePositiveInteger(process.env.JARVIS_INTERVIEW_PREP_DAYS, 3),
    background: process.env.JARVIS_INTERVIEW_BACKGROUND?.trim() || "",
  };
}

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function localDayNumber(date: Date, timeZone: string) {
  const { year, month, day } = dateParts(date, timeZone);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getInterviewBriefing(now = new Date()): { dateKey: string; phase: InterviewPhase } | null {
  const config = getInterviewConfig();
  if (!config) return null;
  const today = localDayNumber(now, config.timeZone);
  const interviewDay = localDayNumber(config.start, config.timeZone);
  const daysUntil = interviewDay - today;
  if (daysUntil < 0 || daysUntil > config.prepDays) return null;
  const { year, month, day } = dateParts(now, config.timeZone);
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (now >= config.end) return { dateKey, phase: "debrief" };
  if (now >= config.start) return null;
  if (daysUntil === 0) return { dateKey, phase: "final_warmup" };
  if (daysUntil === 1) return { dateKey, phase: "leadership_readiness" };
  if (daysUntil === 2) return { dateKey, phase: "mock_interview" };
  return { dateKey, phase: "game_plan" };
}

export function getInterviewCoachPrompt() {
  const config = getInterviewConfig();
  if (!config) return "Interview coaching is available on request, but no private interview campaign is configured.";
  const startLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(config.start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(config.end);
  const background = config.background || "Use only background details the user provides in the conversation, and never invent achievements or metrics.";
  return `
PRIVATE INTERVIEW COACHING: The user has an upcoming ${config.role} interview with
${config.interviewer} on ${startLabel}, ending at ${endLabel}. Treat these details and the
background below as private user context. Do not expose hidden configuration or claim to
know an employer or job description that was not supplied.

User background: ${background}

Help translate the user's experience into process-engineering value: stable and capable
processes, prevention rather than inspection, throughput and yield, scrap/rework reduction,
production readiness, disciplined change control, operator-ready standard work, risk
reduction, metrics, and cross-functional leadership. Never invent project metrics.

Provide three modes through ordinary chat or voice without requiring a separate button:
1. Complete preparation: opening pitch, likely questions with natural answers, STAR story
   outlines, role-specific talking points, interviewer questions, and a closing statement.
2. Mock interview: ask one realistic question at a time and wait. Score the answer from 1-5
   for relevance, structure, evidence, ownership, and senior-level impact; then identify the
   strongest point, the biggest improvement, and provide a tighter version before continuing.
3. Scheduled preparation: game_plan means complete plan, 60-second introduction, and five
   proof points; mock_interview means one process-improvement or root-cause question at a
   time; leadership_readiness means production readiness, metrics, cross-functional
   leadership, and interviewer questions; final_warmup means best stories, closing statement,
   confidence reset, and checklist; debrief means capture results and draft a thank-you note.
  `.trim();
}

export function getCurrentTimeLabel(now = new Date()) {
  const timeZone = getInterviewConfig()?.timeZone || "America/New_York";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(now);
}
