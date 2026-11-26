import { connection } from "next/server";
import { BarChart } from "@/components/admin/bar-chart";
import { AdminHeader, queryText, Table } from "@/components/admin/ui";
import { salesReport } from "@/features/admin/reports";
import { label } from "@/lib/labels";
import { formatPence } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { addDaysToKey, dateKey, isDateKey } from "@/lib/time";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await connection();
  await requireAdmin();
  const params = await searchParams;
  const today = dateKey(new Date());
  const asked = (value: string | string[] | undefined, fallback: string) =>
    isDateKey(queryText(value)) ? queryText(value) : fallback;
  let to = asked(params.to, today);
  let from = asked(params.from, addDaysToKey(to, -29));
  if (from > to) [from, to] = [to, from];
  // Keep very long ranges manageable.
  if (from < addDaysToKey(to, -1095)) from = addDaysToKey(to, -1095);

  const r = await salesReport({ from, to });
  const range = `from=${from}&to=${to}`;
  const stats: [string, string][] = [
    ["Net takings", formatPence(r.netPence)],
    ["Products", formatPence(r.productPence)],
    ["Appointments", formatPence(r.appointmentPence)],
    ["Refunded", formatPence(r.refundedPence)],
    ["Product orders", String(r.orders)],
    ["Appointments dated in period", String(r.appointments)],
    ["Cancelled", String(r.cancelled)],
    ["No shows", String(r.noShows)],
  ];
  const presets: [string, number][] = [
    ["7 days", 6],
    ["30 days", 29],
    ["90 days", 89],
    ["12 months", 364],
  ];

  return (
    <div className="space-y-8">
      <AdminHeader title="Sales and revenue">
        <a download href={`/api/admin/export/payments?${range}`} className="btn btn-outline btn-sm">
          Download CSV
        </a>
      </AdminHeader>
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap items-end gap-2" key={range}>
          <label className="text-sm">
            From
            <input type="date" name="from" defaultValue={from} className="input" />
          </label>
          <label className="text-sm">
            To
            <input type="date" name="to" defaultValue={to} className="input" />
          </label>
          <button className="btn btn-outline">Show</button>
        </form>
        {presets.map(([name, days]) => (
          <a key={name} href={`/admin/reports?from=${addDaysToKey(today, -days)}&to=${today}`} className="chip">
            {name}
          </a>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([name, value]) => (
          <li key={name} className="card">
            <p className="text-sm text-muted">{name}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </li>
        ))}
      </ul>

      <section className="card">
        <BarChart bars={r.series} title={`Net takings per ${r.unit} (payments less refunds)`} />
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted">View as a table</summary>
          <div className="mt-3">
            <Table head={["Period", "Net takings"]} empty="No data.">
              {r.series.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td>{formatPence(s.pence)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </details>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl">By payment method</h2>
        <Table head={["Method", "Net"]} empty="No payments in this period.">
          {r.byMethod.map(([method, pence]) => (
            <tr key={method}>
              <td>{label(method)}</td>
              <td>{formatPence(pence)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 font-display text-2xl">Best selling products</h2>
          <Table head={["Product", "Sold", "Value"]} empty="No sales in this period.">
            {r.bestSellers.map((b) => (
              <tr key={`${b.name}-${b.option}`}>
                <td>
                  {b.name}
                  {b.option && <span className="block text-xs text-muted">{b.option}</span>}
                </td>
                <td>{b.units}</td>
                <td>{formatPence(b.value)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-3 font-display text-2xl">Popular services</h2>
          <Table head={["Service", "Bookings", "Booked value"]} empty="No appointments in this period.">
            {r.popular.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.total}</td>
                <td>{formatPence(p.value)}</td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </div>
  );
}
