// Conservative numeric grounding shared by assistance and full-site creation.
// A matching number alone is not evidence: its unit must also match.
// Read grouped thousands as a single value, including French nonbreaking spaces.
// Otherwise a supplied "1 500 €" could wrongly support an invented "500 €".
const numberPattern = String.raw`\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?`;
const quantitativePattern = new RegExp(
  String.raw`(?:[€£$]\s*${numberPattern})|(?:\b${numberPattern}\s*(?:%|€|£|\$))|(?:\b${numberPattern}\s*(?:euros?|dollars?|usd|gbp|minutes?|mins?|heures?|hours?|hrs?|jours?|days?|semaines?|weeks?|mois|months?|ans?|années?|years?|clients?|customers?|projets?|projects?|pays|countries|destinations?|voyages?|trips?|réservations?|bookings?)\b)|(?:\b(?:19|20)\d{2}\b)|(?:\b24\s*\/\s*7\b)`,
  "giu"
);
const claimNumberPattern = new RegExp(numberPattern, "u");

function claimKey(claim: string) {
  const text = claim.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/^24\s*\/\s*7$/.test(text)) return "availability:24/7";
  const number = text.match(claimNumberPattern)?.[0];
  if (!number) return "";
  const value = String(Number(number.replace(/[ \u00a0\u202f]/g, "").replace(",", ".")));
  const unit = text.replace(claimNumberPattern, "").trim();
  if (!unit) return "calendar_year:" + value;
  const aliases: Array<readonly [RegExp, string]> = [
    [/^(?:€|euros?)$/, "EUR"],
    [/^(?:\$|dollars?|usd)$/, "USD"],
    [/^(?:£|gbp)$/, "GBP"],
    [/^%$/, "percent"],
    [/^(?:minutes?|mins?)$/, "minute"],
    [/^(?:heures?|hours?|hrs?)$/, "hour"],
    [/^(?:jours?|days?)$/, "day"],
    [/^(?:semaines?|weeks?)$/, "week"],
    [/^(?:mois|months?)$/, "month"],
    [/^(?:ans?|annees?|years?)$/, "year"],
    [/^(?:clients?|customers?)$/, "client"],
    [/^(?:projets?|projects?)$/, "project"],
    [/^(?:pays|countries)$/, "country"],
    [/^destinations?$/, "destination"],
    [/^(?:voyages?|trips?)$/, "trip"],
    [/^(?:reservations?|bookings?)$/, "booking"]
  ];
  const canonicalUnit = aliases.find(([pattern]) => pattern.test(unit))?.[1] || unit;
  return canonicalUnit + ":" + value;
}

export function unsupportedQuantitativeClaims(text: string, evidence: string): string[] {
  const supported = new Set((evidence.match(quantitativePattern) || []).map(claimKey));
  return [...new Set((text.match(quantitativePattern) || []).filter((claim) => !supported.has(claimKey(claim))))];
}
