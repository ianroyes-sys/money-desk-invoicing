#!/usr/bin/env node
// Invoice CLI over the same files the web app uses, so a script, cron job or agent can
// bill without the UI.
//   node scripts/invoice.mjs list
//   node scripts/invoice.mjs new --client "Harbor Bakery" --amount 99 --note "App maintenance, February"
//   node scripts/invoice.mjs paid INV-0003
//   node scripts/invoice.mjs summary
import { createInvoice, markPaid, summarize } from "../lib/money.mjs";
import { businessConfig, now, readJSON, writeJSON } from "../lib/store.mjs";

const [cmd = "list", ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const biz = businessConfig();
const invoices = readJSON("invoices.json", []);
const usd = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

try {
  if (cmd === "list") {
    const s = summarize({ invoices, now: now() });
    for (const i of s.invoices) console.log(`${i.id.padEnd(16)} ${i.status.padEnd(8)} ${usd(i.amount).padStart(12)}  ${i.client}${i.due && !i.paid ? `  (due ${i.due})` : ""}`);
    if (!s.invoices.length) console.log("No invoices yet.");
  } else if (cmd === "new") {
    if (biz.readOnly) throw new Error("READ_ONLY=1 is set");
    const inv = createInvoice({ client: flag("client"), amount: flag("amount"), note: flag("note"), due: flag("due") }, invoices, { ...biz, now: now() });
    writeJSON("invoices.json", [...invoices, inv]);
    console.log(`Issued ${inv.id} to ${inv.client} for ${usd(inv.amount)}, due ${inv.due}`);
  } else if (cmd === "paid") {
    if (biz.readOnly) throw new Error("READ_ONLY=1 is set");
    writeJSON("invoices.json", markPaid(invoices, rest[0], now()));
    console.log(`Marked ${rest[0]} paid`);
  } else if (cmd === "summary") {
    const s = summarize({
      register: readJSON("register.json", {}),
      invoices,
      wins: readJSON("wins.json", []),
      pipeline: readJSON("pipeline.json", {}),
      now: now(),
    });
    console.log(`MRR ${usd(s.mrr.active)} (+${usd(s.mrr.pending)} pending) · outstanding ${usd(s.invoiced)} (${s.overdue} overdue) · collected ${usd(s.collected)}`);
    console.log(`Mission: ${s.mission.goal} by ${s.mission.by} (${s.mission.daysLeft}d left)`);
  } else {
    console.log("usage: invoice.mjs list | new --client X --amount N [--note T] [--due YYYY-MM-DD] | paid ID | summary");
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
