import { NextRequest, NextResponse } from "next/server";
import { createInvoice, markPaid, openActions, summarize } from "@/lib/money.mjs";
import { businessConfig, now as clock, readJSON, writeJSON } from "@/lib/store.mjs";
import { stripeBalance } from "@/lib/stripe.mjs";
import type { DeskAction, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = clock();
  const desk = readJSON<{ date?: string; actions?: DeskAction[] } | null>("money-desk.json", null);
  return NextResponse.json({
    ...summarize({
      register: readJSON("register.json", {}),
      invoices: readJSON("invoices.json", []),
      wins: readJSON("wins.json", []),
      pipeline: readJSON("pipeline.json", {}),
      now,
    }),
    stripe: await stripeBalance(),
    desk: { date: desk?.date ?? null, actions: openActions(desk, now) },
    business: businessConfig(),
  });
}

/**
 * POST { action: "invoice", client, amount?, items?, due?, note? }  issue an invoice
 * POST { action: "paid", id }                                       mark it settled
 */
export async function POST(req: NextRequest) {
  const biz = businessConfig();
  if (biz.readOnly) return NextResponse.json({ error: "read-only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const invoices = readJSON("invoices.json", []) as Invoice[];

  try {
    if (body.action === "invoice") {
      const invoice = createInvoice(body, invoices, { now: clock(), prefix: biz.prefix, numbering: biz.numbering, netDays: biz.netDays });
      writeJSON("invoices.json", [...invoices, invoice]);
      return NextResponse.json({ ok: true, invoice });
    }
    if (body.action === "paid") {
      writeJSON("invoices.json", markPaid(invoices, String(body.id ?? ""), clock()));
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "bad-invoice") return NextResponse.json({ error: err.code, detail: err.message }, { status: 400 });
    if (err.code === "no-such-invoice") return NextResponse.json({ error: err.code }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ error: "unknown-action" }, { status: 400 });
}
