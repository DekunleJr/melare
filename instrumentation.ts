/*
 * The built-in scheduler: while the server is running it calls the tasks route
 * every ten minutes (reminders, clean-up, basket reminders, daily backup), so no
 * separate cron service is needed. Set DISABLE_SCHEDULER=1 if your host runs its own.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_SCHEDULER === "1" || !process.env.CRON_SECRET) return;

  const globalForScheduler = globalThis as unknown as { melareScheduler?: boolean };
  if (globalForScheduler.melareScheduler) return;
  globalForScheduler.melareScheduler = true;

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const run = async () => {
    try {
      const response = await fetch(`${site}/api/cron/tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(5 * 60_000),
      });
      if (!response.ok) console.error(`Scheduled tasks returned ${response.status}`);
    } catch (error) {
      console.error(`Scheduled tasks could not reach ${site}`, error);
    }
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 10 * 60_000).unref();
}
