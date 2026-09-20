// One implementation of the money maths, used by the admin calculator, the storefront pay panel
// and the server's /api/generate, so the three can never disagree.

export const DEFAULT_GST_RATE = 0.18;

export function gstFor(priceInr: number, gstRate: number): number {
  return Math.round(priceInr * gstRate);
}

export function totalWithGst(priceInr: number, gstRate: number): number {
  return priceInr + gstFor(priceInr, gstRate);
}

export function marginPct(priceInr: number, costInr: number): number {
  const price = Number(priceInr) || 0;
  const cost = Number(costInr) || 0;
  if (!price) return 0;
  return Math.round(((price - cost) / price) * 100);
}
