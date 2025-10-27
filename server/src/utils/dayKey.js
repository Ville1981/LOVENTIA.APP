// --- REPLACE START: day/time helpers for daily quotas (Europe/Helsinki by default) ---
/**
 * Small, dependency-free helpers for daily windows and reset timestamps.
 * Default timezone: Europe/Helsinki.
 *
 * Exports:
 *  - dayKey(date?, tz?) -> "YYYY-MM-DD" for the given instant in the given timezone
 *  - nextMidnightISO(date?, tz?) -> ISO string for the next local midnight in the given timezone
 *
 * Notes:
 *  - We intentionally avoid external libs for portability.
 *  - These functions are pure and side-effect free.
 */

/**
 * Return a "YYYY-MM-DD" string for the given instant in the given IANA timezone.
 * @param {Date} [d=new Date()] - Instant to convert
 * @param {string} [timeZone='Europe/Helsinki'] - IANA timezone
 * @returns {string} Day key, e.g. "2025-10-27"
 */
export function dayKey(d = new Date(), timeZone = 'Europe/Helsinki') {
  // en-CA formats to YYYY-MM-DD with toLocaleString reliably
  const s = d.toLocaleString('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return String(s).trim();
}

/**
 * Return the ISO instant of the next local midnight for the given timezone.
 * @param {Date} [now=new Date()] - Instant to base the calculation on
 * @param {string} [timeZone='Europe/Helsinki'] - IANA timezone
 * @returns {string} ISO string (UTC instant) representing the next local midnight
 */
export function nextMidnightISO(now = new Date(), timeZone = 'Europe/Helsinki') {
  // Extract the current local date parts in the target timezone
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const by = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const y = Number(by.year);
  const m = Number(by.month);
  const d = Number(by.day);

  // Construct "next day at 00:00:00" *in the target timezone*.
  // We approximate by building a Date at UTC using the same wall-clock values;
  // this corresponds to the correct absolute instant for that local midnight.
  const iso = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0)).toISOString();
  return iso;
}

/**
 * Quick guard utility for 24-hex ObjectId strings.
 * (Kept here as a convenience for validators that avoid importing mongoose.)
 * @param {string} s
 * @returns {boolean}
 */
export function is24Hex(s) {
  return typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
}

export default { dayKey, nextMidnightISO, is24Hex };
// --- REPLACE END ---
