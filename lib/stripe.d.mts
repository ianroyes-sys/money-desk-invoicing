export function stripeBalance(
  key?: string,
  fetchImpl?: typeof fetch,
): Promise<{ configured: boolean; available?: number; pending?: number; error?: string }>;
