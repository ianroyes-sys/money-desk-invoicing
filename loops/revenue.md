---
name: Revenue Loop
slug: revenue
purpose: Produce one drafted, ready-to-execute revenue action every day.
enabled: false
retired: merged into money-desk.md. It kept restating the same blocker each day without producing a new artifact.
model: sonnet
effort: high
max_passes: 5
max_minutes: 40
outbound: none
schedule_hours: 6
schedule_minute: 47
---

# GOAL

Kept for reference: this is the loop the money desk replaced. It produced, every day, **one
drafted, ready-to-execute revenue action**: not a list of ideas, not a strategy memo. One
concrete artifact the owner can approve and fire.

# ON EACH PASS

0. **Check the approval queue before drafting.** Count only tasks this loop created. If three or
   more are still pending, create nothing new this run: report them and stop. For approved work,
   check whether the artifact already exists before proposing anything similar, and never ask
   for the same approval twice.
1. **Read the board.** For each revenue engine (client builds, retainers, products), establish
   the current state from live sources, not from notes: what shipped, what is live, what is
   stalled, what has paying users.
2. **Find the bottleneck.** Exactly one thing is the binding constraint on the next recurring
   dollar. Name it in one sentence. Common shapes: a live app nobody knows about, a payment
   path that isn't wired, an outreach list that was never sent, a pricing page that doesn't exist.
3. **Draft the unblock.** Produce the actual artifact that removes it: the email, the pricing
   copy, the payment wiring steps, the landing-page section. Real words, real numbers.
4. **File it** in the approval queue with `approval: pending`.
5. **Log** the bottleneck call and the artifact in a decision log (one dated line, append-only).

# DONE-WHEN

- Blocked or queue full: a receipt naming the exact blocking items, `STATUS: blocked`.
- Nothing new to do: cite the existing artifacts, `STATUS: nothing-to-do`. Never manufacture one.
- Otherwise: one named bottleneck with the reasoning, one complete artifact in the approval
  queue (no placeholders, no `[TBD]`), and the decision log updated.

# GUARDRAILS

- `outbound: none`. Nothing is sent; everything stops at the approval queue.
- No income claims, guarantees, or invented testimonials in any draft.
- Do not edit the owner's goals file.
