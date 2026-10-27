// A printable invoice: open, Cmd/Ctrl+P, "Save as PDF", send. Styled as a plain paper
// document (white, dark ink) because this is the one surface a client sees.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { businessConfig, readJSON } from "@/lib/store.mjs";
import type { Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Invoice ${id}` };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoices = readJSON("invoices.json", []) as Invoice[];
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();
  const biz = businessConfig();

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[#f5f3ee] text-[#191612] print:static print:bg-white">
      <div className="mx-auto max-w-2xl px-6 py-14 sm:px-10 print:px-2 print:py-4">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#191612] pb-8">
          <div>
            <p className="text-2xl font-semibold uppercase tracking-tight">{biz.name}</p>
            <p className="mt-1 text-[13px] text-[#191612]/60">
              {biz.tagline} · {biz.website}
            </p>
            <p className="text-[13px] text-[#191612]/60">{biz.email}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm tracking-widest text-[#191612]/50">INVOICE</p>
            <p className="mt-1 font-mono text-lg">{inv.id}</p>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap justify-between gap-6 text-[14px]">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-[#191612]/45">BILLED TO</p>
            <p className="mt-1.5 text-[16px] font-medium">{inv.client}</p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-mono text-[11px] tracking-widest text-[#191612]/45">ISSUED </span>
              {inv.issued}
            </p>
            {inv.due && (
              <p className="mt-1">
                <span className="font-mono text-[11px] tracking-widest text-[#191612]/45">DUE </span>
                {inv.due}
              </p>
            )}
            {inv.paid && (
              <p className="mt-2 inline-block rounded border-2 border-[#1a7a4a] px-2 py-0.5 font-mono text-[12px] font-bold tracking-widest text-[#1a7a4a]">
                PAID {inv.paid}
              </p>
            )}
          </div>
        </div>

        <table className="mt-10 w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#191612]/25 text-left font-mono text-[11px] tracking-widest text-[#191612]/45">
              <th className="pb-2 font-normal">DESCRIPTION</th>
              <th className="pb-2 text-right font-normal">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-[#191612]/10">
                <td className="py-3.5 pr-6">{it.desc}</td>
                <td className="py-3.5 text-right font-mono">{usd(it.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-5 text-right font-mono text-[11px] tracking-widest text-[#191612]/45">TOTAL</td>
              <td className="pt-5 text-right font-mono text-xl font-semibold">{usd(inv.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {inv.note && <p className="mt-8 text-[13px] leading-relaxed text-[#191612]/70">{inv.note}</p>}

        <p className="mt-14 border-t border-[#191612]/15 pt-5 text-[12px] text-[#191612]/50">
          Terms: Net {biz.netDays}. {biz.paymentNote}
        </p>

        <p className="mt-8 inline-block rounded-full border border-[#191612]/25 px-5 py-2 font-mono text-[12px] tracking-widest print:hidden">
          CMD/CTRL + P TO SAVE AS PDF
        </p>
      </div>
    </div>
  );
}
