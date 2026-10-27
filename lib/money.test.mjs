import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  addDays,
  createInvoice,
  invoiceStatus,
  markPaid,
  nextInvoiceId,
  openActions,
  rankActions,
  summarize,
} from "./money.mjs";
import { stripeBalance } from "./stripe.mjs";

const NOW = new Date("2026-01-20T15:00:00Z");
const load = (f) => JSON.parse(fs.readFileSync(new URL(`../data/example/${f}`, import.meta.url), "utf8"));

test("sequential numbering is max+1 and survives gaps", () => {
  assert.equal(nextInvoiceId([], { prefix: "FNS" }), "FNS-0001");
  const ids = [{ id: "FNS-0001" }, { id: "FNS-0004" }, { id: "OTHER-0099" }];
  assert.equal(nextInvoiceId(ids, { prefix: "FNS" }), "FNS-0005");
});

test("yearly numbering resets per year", () => {
  const ids = [{ id: "FNS-2025-007" }, { id: "FNS-2026-002" }];
  assert.equal(nextInvoiceId(ids, { prefix: "fns", numbering: "yearly", year: 2026 }), "FNS-2026-003");
  assert.equal(nextInvoiceId(ids, { prefix: "FNS", numbering: "yearly", year: 2027 }), "FNS-2027-001");
});

test("createInvoice defaults to Net 14 and one line from the note", () => {
  const inv = createInvoice({ client: "Harbor Bakery", amount: "1500", note: "Ordering app build" }, [], { now: NOW, prefix: "FNS" });
  assert.deepEqual(inv, {
    id: "FNS-0001",
    client: "Harbor Bakery",
    amount: 1500,
    issued: "2026-01-20",
    due: "2026-02-03",
    items: [{ desc: "Ordering app build", amount: 1500 }],
    note: "Ordering app build",
  });
  assert.equal(addDays("2026-01-20", 30), "2026-02-19");
});

test("createInvoice sums line items and rejects mismatches and bad input", () => {
  const items = [{ desc: "Design", amount: 400 }, { desc: "Build", amount: 1100.5 }];
  assert.equal(createInvoice({ client: "A", items }, [], { now: NOW }).amount, 1500.5);
  const code = (fn) => { try { fn(); } catch (e) { return e.code; } };
  assert.equal(code(() => createInvoice({ client: "A", amount: 10, items }, [], { now: NOW })), "bad-invoice");
  assert.equal(code(() => createInvoice({ client: " ", amount: 10 }, [], { now: NOW })), "bad-invoice");
  assert.equal(code(() => createInvoice({ client: "A", amount: -5 }, [], { now: NOW })), "bad-invoice");
  assert.equal(code(() => createInvoice({ client: "A", amount: "abc" }, [], { now: NOW })), "bad-invoice");
});

test("markPaid stamps once and reports unknown ids", () => {
  const list = [{ id: "X-0001", client: "A", amount: 10, issued: "2026-01-01", items: [] }];
  const paid = markPaid(list, "X-0001", NOW);
  assert.equal(paid[0].paid, "2026-01-20");
  assert.equal(list[0].paid, undefined, "input not mutated");
  assert.equal(markPaid(paid, "X-0001", new Date("2026-03-01"))[0].paid, "2026-01-20");
  assert.throws(() => markPaid(list, "nope"), (e) => e.code === "no-such-invoice");
});

test("invoiceStatus: open until the day after due, then overdue", () => {
  assert.equal(invoiceStatus({ due: "2026-01-20" }, NOW), "open");
  assert.equal(invoiceStatus({ due: "2026-01-19" }, NOW), "overdue");
  assert.equal(invoiceStatus({ due: "2026-01-01", paid: "2026-01-02" }, NOW), "paid");
});

test("summarize the example data", () => {
  const s = summarize({
    register: load("register.json"),
    invoices: load("invoices.json"),
    wins: load("wins.json"),
    pipeline: load("pipeline.json"),
    now: NOW,
  });
  assert.equal(s.mrr.active, 198);
  assert.equal(s.mrr.pending, 149);
  assert.equal(s.collected, 3099);
  assert.equal(s.invoiced, 1747);
  assert.equal(s.overdue, 1);
  assert.equal(s.winsTotal, 500);
  assert.ok(s.deals.every((d) => d.stage !== "won" && d.stage !== "lost"));
  assert.equal(s.invoices[0].id, "INV-0005", "newest first");
  assert.equal(s.daysSinceMove, 2);
});

test("summarize handles an empty install", () => {
  const s = summarize({ now: NOW });
  assert.equal(s.invoiced, 0);
  assert.equal(s.daysSinceMove, null);
  assert.ok(s.mission.daysLeft > 0);
});

test("ranking puts warm money first, then dollars per minute", () => {
  const ranked = rankActions([
    { id: "cold-big", warm: false, amountUsd: 10000, probability: 0.05, minutes: 30 },
    { id: "warm-small", warm: true, amountUsd: 99, probability: 0.9, minutes: 5 },
    { id: "warm-big", warm: true, amountUsd: 1500, probability: 0.5, minutes: 20 },
  ]);
  assert.deepEqual(ranked.map((a) => a.id), ["warm-big", "warm-small", "cold-big"]);
  const desk = load("money-desk.json");
  const open = openActions(desk, NOW);
  assert.ok(open.length <= 3);
  assert.ok(open.every((a) => a.status === "open"));
});

test("stripeBalance fails soft", async () => {
  assert.deepEqual(await stripeBalance(undefined), { configured: false });
  const ok = async () => ({ ok: true, json: async () => ({ available: [{ amount: 12345 }], pending: [{ amount: 500 }] }) });
  assert.deepEqual(await stripeBalance("rk_test_x", ok), { configured: true, available: 123.45, pending: 5 });
  const bad = async () => ({ ok: false, status: 401 });
  assert.deepEqual(await stripeBalance("rk_test_x", bad), { configured: true, error: "Stripe 401" });
  const boom = async () => { throw new Error("offline"); };
  assert.deepEqual(await stripeBalance("rk_test_x", boom), { configured: true, error: "unreachable" });
});
