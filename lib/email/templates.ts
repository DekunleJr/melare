/** Minimal, dependency-free email layout. All dynamic text is escaped here. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  businessName: string;
  heading: string;
  paragraphs?: string[];
  /** Label / value rows */
  details?: [string, string][];
  button?: { label: string; url: string };
  footer?: string;
};

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const paragraphs = c.paragraphs ?? [];
  const details = c.details ?? [];

  const html = `<!doctype html><html><body style="margin:0;background:#faf5ea;font-family:Helvetica,Arial,sans-serif;color:#2b211b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;letter-spacing:2px;color:#3d2317">${escapeHtml(c.businessName)}</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#3d2317">${escapeHtml(c.heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;white-space:pre-line">${escapeHtml(p)}</p>`).join("")}
${
  details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #e8dcc4">${details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #e8dcc4;color:#6f6055;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e8dcc4;text-align:right;white-space:pre-line">${escapeHtml(v)}</td></tr>`,
        )
        .join("")}</table>`
    : ""
}
${c.button ? `<p style="margin:24px 0"><a href="${escapeHtml(c.button.url)}" style="background:#dcc38f;color:#0b0908;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(c.button.label)}</a></p>` : ""}
${c.footer ? `<p style="margin:20px 0 0;font-size:12px;color:#6f6055;line-height:1.6;white-space:pre-line">${escapeHtml(c.footer)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    c.heading,
    "",
    ...paragraphs,
    "",
    ...details.map(([k, v]) => `${k}: ${v}`),
    c.button ? `\n${c.button.label}: ${c.button.url}` : "",
    c.footer ? `\n${c.footer}` : "",
    `\n${c.businessName}`,
  ].join("\n");

  return { html, text };
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

type CalendarEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
};

function icsEvent(event: CalendarEvent): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${icsText(event.summary)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    "END:VEVENT",
  ];
}

const wrap = (lines: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MelareBeauty//Bookings//EN",
    ...lines,
    "END:VCALENDAR",
  ].join("\r\n");

export const buildIcs = (event: CalendarEvent) => wrap(icsEvent(event));

/** A whole calendar for subscriptions. */
export const buildCalendar = (name: string, events: CalendarEvent[]) =>
  wrap([
    `X-WR-CALNAME:${icsText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...events.flatMap(icsEvent),
  ]);
