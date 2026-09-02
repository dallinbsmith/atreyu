// Real Clearbit Reveal fetch — reverse-IP firmographic lookup, the one piece
// that touches the real secret. Request shape (GET .../v1/companies/find?ip=,
// Authorization: Bearer <key>) is not a guess — it's the same contract this
// project's own P0-36 spike already exercised successfully against the real
// API (spike/edge/reveal.js, ported from Falkor web/src/utils/middleware/
// variants.ts's getRevealData). Reconfirm before a real production key lands:
// P0-0 flags the Clearbit -> HubSpot/Breeze rebrand (~2024) and asks whether
// Reveal itself is being sunset — this endpoint inherits that open question,
// it does not resolve it.
const ENDPOINT = 'https://reveal.clearbit.com/v1/companies/find';

export const fetchReveal = async ({ ip, apiKey, signal }) => {
  const resp = await fetch(`${ENDPOINT}?ip=${encodeURIComponent(ip)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!resp.ok) throw new Error(`clearbit reveal responded ${resp.status}`);
  return resp.json();
};
