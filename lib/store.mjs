// File-backed records. Reads `data/<file>` when you have your own copy and falls back to
// the fictional `data/example/<file>` otherwise. Writes always go to `data/<file>`
// (git-ignored), so trying the app never edits the samples.

import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.MONEY_DATA_DIR || path.join(process.cwd(), "data");
const EXAMPLE_DIR = path.join(process.cwd(), "data", "example");

export function readJSON(file, fallback) {
  for (const dir of [DATA_DIR, EXAMPLE_DIR]) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch {
      /* try the next location */
    }
  }
  return fallback;
}

export function writeJSON(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, target);
}

/**
 * The clock. DEMO_NOW pins it (YYYY-MM-DD). While you are still on the sample data
 * (no data/invoices.json yet), it is pinned to the samples' `_demoNow` so stale-deal
 * and overdue math reads the way the samples were written.
 */
export function now(env = process.env) {
  if (env.DEMO_NOW) return new Date(`${env.DEMO_NOW}T15:00:00Z`);
  if (!fs.existsSync(path.join(DATA_DIR, "invoices.json"))) {
    const demo = readJSON("register.json", {})._demoNow;
    if (demo) return new Date(`${demo}T15:00:00Z`);
  }
  return new Date();
}

/** Business identity printed on invoices. All optional; defaults are a fictional studio. */
export function businessConfig(env = process.env) {
  return {
    name: env.BUSINESS_NAME || "Fieldnote Studio",
    tagline: env.BUSINESS_TAGLINE || "Apps and websites for small businesses",
    email: env.BUSINESS_EMAIL || "billing@example.com",
    website: env.BUSINESS_WEBSITE || "example.com",
    paymentNote: env.PAYMENT_INSTRUCTIONS || "Pay by bank transfer or card using the payment link in your invoice email.",
    prefix: env.INVOICE_PREFIX || "INV",
    numbering: env.INVOICE_NUMBERING === "yearly" ? "yearly" : "sequential",
    netDays: Number(env.NET_DAYS) || 14,
    readOnly: env.READ_ONLY === "1",
  };
}
