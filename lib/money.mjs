// Pure money logic: invoice numbering, Net-N due dates, payment status, the revenue summary
// and the money-desk action ranking. No file or network access here, so every rule is
// covered by node:test (lib/money.test.mjs) and shared by the API route, the printable
// invoice page and the CLI.

const DAY = 86_400_000;

/** @typedef {{ desc: string, amount: number }} LineItem */
/**
 * @typedef {{
 *   id: string, client: string, amount: number, issued: string, due?: string,
 *   paid?: string, items: LineItem[], note?: string
 * }} Invoice
 */

/** YYYY-MM-DD for a Date (UTC, so tests are timezone-proof). */
export function isoDay(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(day, n) {
  return isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * DAY);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD or Date-ish). Negative when `to` is earlier. */
export function daysBetween(from, to) {
  const a = new Date(typeof from === "string" && from.length === 10 ? `${from}T12:00:00Z` : from).getTime();
  const b = new Date(typeof to === "string" && to.length === 10 ? `${to}T12:00:00Z` : to).getTime();
  return Math.floor((b - a) / DAY);
}

/**
 * Invoice numbers. Two schemes:
 *   sequential (default): PREFIX-0001, PREFIX-0002, ... never resets
 *   yearly:               PREFIX-2026-001, resets each January
 * The next number is max(existing) + 1, not count + 1, so a deleted invoice never
 * causes a duplicate number.
 */
export function nextInvoiceId(invoices, { prefix = "INV", numbering = "sequential", year } = {}) {
  const p = String(prefix).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "INV";
  if (numbering === "yearly") {
    const y = String(year ?? new Date().getUTCFullYear());
    const re = new RegExp(`^${p}-${y}-(\\d+)$`);
    const max = Math.max(0, ...invoices.map((i) => Number(re.exec(i.id)?.[1] ?? 0)));
    return `${p}-${y}-${String(max + 1).padStart(3, "0")}`;
  }
  const re = new RegExp(`^${p}-(\\d+)$`);
  const max = Math.max(0, ...invoices.map((i) => Number(re.exec(i.id)?.[1] ?? 0)));
  return `${p}-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Build a new invoice from loose input (a form or an API body). Throws an Error with
 * `code = "bad-invoice"` when the input can't make a valid invoice.
 * - With `items`, the amount is their sum (an explicit mismatching amount is rejected).
 * - Without `items`, one line is made from `note` (or "Services") and `amount`.
 * - `due` defaults to issued + netDays (Net 14 unless configured).
 */
export function createInvoice(input, existing, opts = {}) {
  const { now = new Date(), netDays = 14, prefix, numbering } = opts;
  const fail = (msg) => Object.assign(new Error(msg), { code: "bad-invoice" });

  const client = String(input?.client ?? "").trim().slice(0, 120);
  if (!client) throw fail("client is required");

  let items;
  if (Array.isArray(input.items) && input.items.length) {
    items = input.items.slice(0, 20).map((x) => ({
      desc: String(x?.desc ?? "").trim().slice(0, 200) || "Services",
      amount: Math.round(Number(x?.amount) * 100) / 100,
    }));
    if (items.some((x) => !Number.isFinite(x.amount) || x.amount < 0)) throw fail("item amounts must be numbers >= 0");
  }
  const itemSum = items ? Math.round(items.reduce((s, x) => s + x.amount, 0) * 100) / 100 : null;
  const given = input.amount === undefined || input.amount === "" ? null : Number(input.amount);
  if (given !== null && itemSum !== null && Math.abs(given - itemSum) > 0.005) {
    throw fail(`amount ${given} does not match line items total ${itemSum}`);
  }
  const amount = itemSum ?? given;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) throw fail("amount must be a positive number");

  const note = input.note ? String(input.note).trim().slice(0, 500) : undefined;
  const issued = isoDay(now);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(input.due ?? "")) ? String(input.due) : addDays(issued, Number(netDays) || 14);

  return {
    id: nextInvoiceId(existing, { prefix, numbering, year: new Date(now).getUTCFullYear() }),
    client,
    amount,
    issued,
    due,
    items: items ?? [{ desc: note?.slice(0, 200) || "Services", amount }],
    ...(note ? { note } : {}),
  };
}

/** Return a copy of `invoices` with `id` marked paid today. Paying twice keeps the first date. */
export function markPaid(invoices, id, now = new Date()) {
  const found = invoices.find((i) => i.id === id);
  if (!found) throw Object.assign(new Error(`no invoice ${id}`), { code: "no-such-invoice" });
  return invoices.map((i) => (i.id === id && !i.paid ? { ...i, paid: isoDay(now) } : i));
}

/** paid | overdue | open */
export function invoiceStatus(inv, now = new Date()) {
  if (inv.paid) return "paid";
  if (inv.due && daysBetween(inv.due, isoDay(now)) > 0) return "overdue";
  return "open";
}

/**
 * The Revenue HQ summary. Everything shown is a recorded value: MRR from the register,
 * invoices from the invoice file, awards from wins. Nothing is projected.
 */
export function summarize({ register = {}, invoices = [], wins = [], pipeline = {}, now = new Date() }) {
  const mission = register.mission || { goal: "First recurring revenue", by: isoDay(new Date(now).getTime() + 90 * DAY) };
  const daysLeft = Math.ceil((new Date(`${mission.by}T23:59:59Z`).getTime() - new Date(now).getTime()) / DAY);
  const recurring = register.recurring || [];
  const sumBy = (rows, pick) => rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);

  const moves = [];
  for (const i of invoices) {
    moves.push(i.issued);
    if (i.paid) moves.push(i.paid);
  }
  for (const w of wins) moves.push(w.at);
  for (const d of pipeline.deals || []) if (d.moved) moves.push(d.moved);
  const latest = moves.filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d || "")).sort().at(-1);

  const withStatus = [...invoices]
    .sort((a, b) => b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id))
    .map((i) => ({ ...i, status: invoiceStatus(i, now) }));

  return {
    mission: { goal: mission.goal, by: mission.by, daysLeft },
    mrr: {
      active: sumBy(recurring.filter((r) => r.status === "active"), (r) => r.amount),
      pending: sumBy(recurring.filter((r) => r.status === "pending"), (r) => r.amount),
    },
    recurring,
    invoices: withStatus,
    invoiced: sumBy(invoices.filter((i) => !i.paid), (i) => i.amount),
    overdue: withStatus.filter((i) => i.status === "overdue").length,
    collected: sumBy(invoices.filter((i) => i.paid), (i) => i.amount),
    winsTotal: sumBy(wins, (w) => w.amount),
    deals: (pipeline.deals || [])
      .filter((d) => !["won", "lost"].includes(d.stage))
      .map((d) => ({ ...d, staleDays: d.moved ? Math.max(0, daysBetween(d.moved, now)) : 0 })),
    daysSinceMove: latest ? Math.max(0, daysBetween(latest.slice(0, 10), now)) : null,
  };
}

/**
 * Money-desk ranking: expected dollars per minute of the owner's time, warm before cold.
 * `warm` actions (money already owed, buyers already talking) always outrank cold ones.
 */
export function scoreAction(a) {
  const minutes = Math.max(1, Number(a.minutes) || 1);
  return ((Number(a.amountUsd) || 0) * (Number(a.probability) || 0)) / minutes;
}

export function rankActions(actions) {
  return [...actions].sort((a, b) => {
    if (!!b.warm !== !!a.warm) return b.warm ? 1 : -1;
    return scoreAction(b) - scoreAction(a);
  });
}

/** Open actions to show (max 3), dropping anything past its deadline or not open. */
export function openActions(desk, now = new Date()) {
  const today = isoDay(now);
  return rankActions(
    (desk?.actions || []).filter((a) => a.status === "open" && (!a.deadline || a.deadline >= today)),
  ).slice(0, 3);
}
