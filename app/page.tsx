"use client";

// REVENUE HQ: MRR, invoices (issue, mark paid, print), the deal board with staleness,
// the money desk's three ranked moves, and a mission clock. Only recorded money is shown.

import { useCallback, useEffect, useState } from "react";
import styles from "@/components/ui.module.css";
import type { MoneyData } from "@/lib/types";

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const field =
  "w-full rounded-lg border border-hairline bg-panel px-3 py-2 text-[13px] text-white placeholder-fog/50 outline-none focus:border-gold/40";

export default function MoneyPage() {
  const [data, setData] = useState<MoneyData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(() => {
    setError("");
    fetch("/api/money", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Revenue data couldn’t load. Your records haven’t changed."));
  }, []);
  useEffect(load, [load]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/money", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(String(response.status));
  }

  async function issue() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "invoice", client, amount: Number(amount), note });
      setShowForm(false);
      setClient("");
      setAmount("");
      setNote("");
      load();
    } catch {
      setError("Invoice couldn’t be issued. Your form is still here; retry when connected.");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(id: string) {
    setPaying(id);
    setError("");
    try {
      await post({ action: "paid", id });
      load();
    } catch {
      setError("Payment status couldn’t be saved. Refresh the records before retrying.");
    } finally {
      setPaying(null);
    }
  }

  const m = data;
  const readOnly = m?.business.readOnly ?? false;
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{m ? m.business.name : "Money desk"} / Revenue HQ</p>
          <h1 className={styles.title}>Make the work pay.</h1>
          <p className={styles.subtitle}>
            Committed revenue, open invoices, and the next deal. The money you’ve recorded, not a projection.
          </p>
          <p className="mt-4 font-mono text-[10px] text-fog" aria-live="polite">
            {m
              ? m.daysSinceMove === null
                ? "No money movement recorded yet. The board is waiting for its first line."
                : `Last money move ${m.daysSinceMove === 0 ? "today" : `${m.daysSinceMove}d ago`}.`
              : "Counting…"}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-col items-start gap-3">
            <button onClick={() => setShowForm(!showForm)} className={styles.action} aria-expanded={showForm}>
              {showForm ? "Close invoice form" : "+ Issue an invoice"}
            </button>
            {m && (
              <span className="font-mono text-[10px] text-fog">
                Numbering {m.business.prefix}-0001 · Net {m.business.netDays}
              </span>
            )}
          </div>
        )}
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button onClick={load}>Refresh records</button>
        </div>
      )}

      {showForm && (
        <form
          className={`${styles.panel} mb-6 flex flex-wrap items-end gap-3`}
          onSubmit={(e) => {
            e.preventDefault();
            issue();
          }}
        >
          <label className="min-w-44 flex-1">
            <span className="seclabel mb-1.5 block">Client</span>
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Harbor Bakery" className={field} />
          </label>
          <label className="w-32">
            <span className="seclabel mb-1.5 block">Amount $</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500" inputMode="decimal" className={field} />
          </label>
          <label className="min-w-56 flex-[2]">
            <span className="seclabel mb-1.5 block">For</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Custom iOS app: design, build, TestFlight delivery"
              className={field}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !client.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
            className="rounded-full border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[11px] tracking-wider text-gold transition-colors hover:bg-gold/15 disabled:opacity-35"
          >
            {busy ? "ISSUING…" : "ISSUE"}
          </button>
        </form>
      )}

      <div className={styles.metrics} aria-busy={!m && !error}>
        <Stat
          label="MRR"
          value={m ? usd(m.mrr.active) : "…"}
          sub={m && m.mrr.pending > 0 ? `${usd(m.mrr.pending)} pending` : "recurring, committed"}
          accent={m && m.mrr.active > 0 ? "#7ef0b2" : undefined}
        />
        <Stat
          label="Mission clock"
          value={m ? `${m.mission.daysLeft}d` : "…"}
          sub={m ? `${m.mission.goal} · by ${m.mission.by}` : ""}
          accent={m && m.mission.daysLeft < 45 ? "#ff8a3d" : undefined}
        />
        <Stat
          label="Outstanding"
          value={m ? usd(m.invoiced) : "…"}
          sub={m && m.overdue > 0 ? `${m.overdue} overdue` : "invoiced, unpaid"}
          accent={m && m.overdue > 0 ? "#ff8a3d" : undefined}
        />
        <Stat
          label="Collected + won"
          value={m ? usd(m.collected + m.winsTotal) : "…"}
          sub={m && m.winsTotal > 0 ? `${usd(m.winsTotal)} in awards` : "paid invoices + awards"}
        />
      </div>

      <section className={`${styles.panel} mt-6`}>
        <div className={styles.sectionHead}>
          <span>Money desk · next moves</span>
          <span>{m?.desk.date ? `ranked ${m.desk.date}` : ""}</span>
        </div>
        {!m ? (
          <p className="text-[13px] text-fog">…</p>
        ) : m.desk.actions.length ? (
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {m.desk.actions.map((a, i) => (
              <li key={a.id} className="rounded-xl border border-hairline bg-panel/60 p-4">
                <p className="font-mono text-[10px] tracking-widest text-gold">
                  #{i + 1} · {usd(a.amountUsd)} · {Math.round(a.probability * 100)}% · {a.minutes} min
                </p>
                <p className="mt-2 text-[14px] leading-snug text-white">{a.title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-fog">{a.why}</p>
                {a.draft && (
                  <details className="mt-3 text-[12px] text-mist">
                    <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-fog">DRAFT · {a.where}</summary>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed">{a.draft}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>
            No ranked moves yet. The money-desk loop writes them to <code>data/money-desk.json</code> each morning.
          </p>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span>The deal board</span>
            <span>{m ? `${m.deals.length} open` : ""}</span>
          </div>
          {m ? (
            m.deals.length ? (
              <div className="space-y-2.5">
                {m.deals.map((d) => (
                  <div key={d.name} className="flex items-baseline gap-3 rounded-xl border border-hairline bg-panel/60 px-4 py-3">
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[8px] tracking-widest ${
                        d.stage === "awaiting" ? "border-gold/40 text-gold" : d.stage === "pitched" ? "border-ice/40 text-ice" : "border-white/15 text-fog"
                      }`}
                    >
                      {d.stage.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-mist">{d.name}</p>
                      {d.value && <p className="truncate font-mono text-[10px] text-fog">{d.value}</p>}
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[10px] ${d.staleDays >= 7 ? "text-coral" : "text-fog/60"}`}
                      title={d.staleDays >= 7 ? "No movement in a week or more" : "Days since last movement"}
                    >
                      {d.staleDays}d
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No open deals recorded. Add them to data/pipeline.json.</p>
            )
          ) : (
            <p className="text-[13px] text-fog">…</p>
          )}
        </section>

        <div className="space-y-4">
          <section className={styles.panel}>
            <p className="seclabel mb-4">Invoices</p>
            {m ? (
              m.invoices.length ? (
                <div>
                  {m.invoices.map((inv) => (
                    <div key={inv.id} className={styles.invoiceRow}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-mist">
                          <span className="font-mono text-[10px] text-fog">{inv.id}</span> · {inv.client}
                        </p>
                        {inv.due && !inv.paid && (
                          <p className={`font-mono text-[10px] ${inv.status === "overdue" ? "text-ember" : "text-fog/70"}`}>
                            {inv.status === "overdue" ? "OVERDUE · " : ""}due {inv.due}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-[12px] text-white">{usd(inv.amount)}</span>
                      {inv.paid ? (
                        <span className="rounded-full border border-[#7ef0b2]/40 px-2 py-0.5 font-mono text-[8px] tracking-widest text-[#7ef0b2]">
                          PAID
                        </span>
                      ) : readOnly ? (
                        <span className="rounded-full border border-gold/40 px-2 py-0.5 font-mono text-[8px] tracking-widest text-gold">OPEN</span>
                      ) : (
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={paying !== null}
                          className="rounded-full border border-hairline px-2.5 py-0.5 font-mono text-[8px] tracking-widest text-fog transition-colors hover:border-[#7ef0b2]/40 hover:text-[#7ef0b2]"
                        >
                          {paying === inv.id ? "SAVING…" : "MARK PAID"}
                        </button>
                      )}
                      <a
                        href={`/invoice/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[9px] tracking-widest text-fog transition-colors hover:text-gold"
                      >
                        PRINT
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No invoices recorded. Use “Issue an invoice” to create your first billing record.</p>
              )
            ) : (
              <p className="text-[13px] text-fog">…</p>
            )}
          </section>

          <section className={styles.panel}>
            <p className="seclabel mb-3">Stripe</p>
            {!m ? (
              <p className="text-[13px] text-fog">{error ? "Balance status unavailable." : "Reading balance connection…"}</p>
            ) : m.stripe.configured ? (
              m.stripe.error ? (
                <p className="text-[13px] text-coral">Key set but {m.stripe.error}.</p>
              ) : (
                <p className="text-[13px] text-mist">
                  {usd(m.stripe.available ?? 0)} available · {usd(m.stripe.pending ?? 0)} pending
                </p>
              )
            ) : (
              <p className="text-[12.5px] leading-relaxed text-fog">
                Not connected. Add <code className="text-mist">STRIPE_SECRET_KEY</code> to{" "}
                <code className="text-mist">.env.local</code> (a restricted key with read access to Balance is enough) to show the
                live balance here.
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <p className="seclabel mb-3">Recurring</p>
            {!m ? (
              <p className="text-[13px] text-fog">{error ? "Recurring records unavailable." : "Reading recurring records…"}</p>
            ) : m.recurring.length ? (
              <div className="space-y-2">
                {m.recurring.map((r) => (
                  <div key={r.name} className="flex items-baseline gap-3" title={r.note || ""}>
                    <span className={`h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${r.status === "active" ? "bg-[#7ef0b2]" : "bg-gold"}`} />
                    <p className="min-w-0 flex-1 truncate text-[13px] text-mist">{r.name}</p>
                    <span className="font-mono text-[11px] text-white">{usd(r.amount)}/mo</span>
                    <span className="font-mono text-[8px] tracking-widest text-fog">{r.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-fog">Nothing recurring yet. That’s the mission.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <section className={styles.metric}>
      <p className="seclabel mb-2">{label}</p>
      <p className={styles.metricValue} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-fog">{sub}</p>}
    </section>
  );
}
