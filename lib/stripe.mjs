// Optional live Stripe balance. Needs only a restricted key with read access to Balance.
// Fails soft: a missing key is "not configured", a bad response is an error string the UI
// shows, never a thrown exception that breaks the page.

export async function stripeBalance(key = process.env.STRIPE_SECRET_KEY, fetchImpl = fetch) {
  if (!key) return { configured: false };
  try {
    const r = await fetchImpl("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { configured: true, error: `Stripe ${r.status}` };
    const b = await r.json();
    const sum = (a) => (a || []).reduce((s, x) => s + (Number(x.amount) || 0), 0) / 100;
    return { configured: true, available: sum(b.available), pending: sum(b.pending) };
  } catch {
    return { configured: true, error: "unreachable" };
  }
}
