import { accessBooking } from "@/features/access";
import { buildIcs } from "@/lib/email/templates";
import { readSettings } from "@/lib/settings";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const booking = await accessBooking(token ? { token } : { id: Number(params.get("id")) });
  if (!booking || booking.status !== "confirmed") {
    return new Response("Not found", { status: 404 });
  }
  const settings = await readSettings();
  const ics = buildIcs({
    uid: `${booking.reference}@melarebeauty`,
    start: booking.startsAt,
    end: booking.endsAt,
    summary: `${booking.serviceName} at ${settings.businessName}`,
    location: settings.address || undefined,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
