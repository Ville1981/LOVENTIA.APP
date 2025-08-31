// --- REPLACE START: Discover service – reusable query builder, visibility guard, image normalization, and runner ---
'use strict';

/* =============================================================================
   CJS/ESM interop for User model (works with CommonJS & ESM exports)
============================================================================= */
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

/* =============================================================================
   Public API (named exports)
   ---------------------------------------------------------------------------
   - buildDiscoverFilters(query, currentUserId, { allowSelf })
   - applyOptionalAgeFilter(filters, query)
   - hiddenExclusionClause(now)
   - buildPagingAndSort(query)
   - normalizeImagePath(v)
   - normalizeImageArray(arr)
   - normalizeUserDoc(u)
   - runDiscover(query, currentUserId, options)
============================================================================= */

/* ----------------------- Option & key whitelists ----------------------- */
export const ALLOWED_FILTERS = [
  'username',
  'gender',
  'orientation',
  'religion',
  'religionImportance',
  'education',
  'profession',
  'professionCategory',
  'country',
  'region',
  'city',
  'children',
  'pets',
  'summary',
  'goals',
  'goal',
  'lookingFor',
  'smoke',
  'drink',
  'drugs',
  'status',
  'bodyType',
  'politicalIdeology',
];

/* ----------------------- Helpers ----------------------- */
/** Parse number safely (accepts numeric strings), returns fallback if NaN/empty */
export function toNumberSafe(v, fallback = undefined) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Truthy guard for query flags (1/true/"1"/"true") */
export function isTruthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Case-insensitive substring regex (escapes special chars) */
export function ciLike(value) {
  try {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  } catch {
    return value;
  }
}

/* ----------------------- Image normalization ----------------------- */
/** Normalize a single image/string into a server-relative path */
export function normalizeImagePath(img) {
  if (!img) return null;

  const raw =
    typeof img === 'string'
      ? img
      : typeof img === 'object' && img.url
      ? img.url
      : null;

  if (!raw || typeof raw !== 'string') return null;

  let s = raw.trim().replace(/\\/g, '/'); // windows slashes → forward
  if (s === '') return null;

  // Already absolute URL → keep as-is (client will accept)
  if (/^https?:\/\//i.test(s)) return s;

  // Strip leading slashes to simplify
  s = s.replace(/^\/+/, '');

  // Ensure single '/uploads/...'
  if (/^uploads\/?/i.test(s)) {
    s = s.replace(/^uploads\/uploads\//i, 'uploads/');
    return `/${s}`;
  }

  // Known static roots (assets/static) → keep one leading slash
  if (/^(assets|static)\//i.test(s)) return `/${s}`;

  // Otherwise treat as bare filename in uploads
  return `/uploads/${s}`;
}

/** Normalize an array of strings/{url} into [{ url }] */
export function normalizeImageArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => (typeof p === 'string' ? p : p?.url))
    .map(normalizeImagePath)
    .filter(Boolean)
    .map((url) => ({ url }));
}

/** Normalize a user doc into API-safe shape (server-relative images, numeric age, friendly id) */
export function normalizeUserDoc(u) {
  // Compose photos preference: photos -> extraImages -> profilePicture
  let photos = [];
  if (Array.isArray(u.photos) && u.photos.length) {
    photos = normalizeImageArray(u.photos);
  } else if (Array.isArray(u.extraImages) && u.extraImages.length) {
    photos = normalizeImageArray(u.extraImages);
  } else if (u.profilePicture) {
    const url = normalizeImagePath(u.profilePicture);
    if (url) photos.push({ url });
  }

  const age = toNumberSafe(u.age, undefined);
  const idStr =
    (u._id && typeof u._id.toString === 'function' && u._id.toString()) ||
    u.id ||
    String(u._id || '');

  return {
    ...u,
    id: idStr,
    age,
    photos,
    profilePicture: photos?.[0]?.url || normalizeImagePath(u.profilePicture) || null,
  };
}

/* ----------------------- Visibility guards ----------------------- */
/**
 * Hidden exclusion logic:
 * - hidden: false OR not present
 * - visibility.isHidden: false OR not present
 * - visibility.hiddenUntil: <= now OR not present
 */
export function hiddenExclusionClause(now = new Date()) {
  return {
    $or: [
      { hidden: { $exists: false } },
      { hidden: false },
      { 'visibility.isHidden': { $exists: false } },
      { 'visibility.isHidden': false },
      { 'visibility.hiddenUntil': { $exists: true, $lte: now } },
    ],
  };
}

/* ----------------------- Filter builders ----------------------- */
/**
 * Build Mongo filter from whitelisted query params.
 * - Maps top-level city/region/country → location.*
 * - 'goals' → 'goal' (schema canonical)
 * - username/summary/profession → case-insensitive partial match
 * - Excludes current user unless allowSelf=true
 */
export function buildDiscoverFilters(query, currentUserId, { allowSelf = false } = {}) {
  const filters = {};

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null || value === '' || !ALLOWED_FILTERS.includes(key)) return;

    if (key === 'city') {
      filters['location.city'] = value;
    } else if (key === 'region') {
      filters['location.region'] = value;
    } else if (key === 'country') {
      filters['location.country'] = value;
    } else if (key === 'goals' || key === 'goal') {
      filters['goal'] = value;
    } else if (key === 'username' || key === 'summary' || key === 'profession') {
      filters[key] = ciLike(value);
    } else {
      filters[key] = value;
    }
  });

  if (currentUserId && !allowSelf) {
    filters._id = { $ne: currentUserId };
  }

  return filters;
}

/** Apply optional age {minAge,maxAge} only when present; defaults 18..120 if one bound missing */
export function applyOptionalAgeFilter(filters, query) {
  const hasMin = Object.prototype.hasOwnProperty.call(query || {}, 'minAge');
  const hasMax = Object.prototype.hasOwnProperty.call(query || {}, 'maxAge');
  if (!(hasMin || hasMax)) return filters;

  let minAge = toNumberSafe(query.minAge, undefined);
  let maxAge = toNumberSafe(query.maxAge, undefined);

  if (!Number.isFinite(minAge)) minAge = 18;
  if (!Number.isFinite(maxAge)) maxAge = 120;

  minAge = Math.max(18, Math.min(120, minAge));
  maxAge = Math.max(18, Math.min(120, maxAge));
  if (minAge > maxAge) [minAge, maxAge] = [maxAge, minAge];

  return { ...filters, age: { $gte: minAge, $lte: maxAge } };
}

/** Build paging and sort from query (safe defaults) */
export function buildPagingAndSort(query) {
  const page = Math.max(1, toNumberSafe(query?.page, 1) || 1);
  const limit = Math.max(1, Math.min(100, toNumberSafe(query?.limit, 100) || 100));

  let sort = undefined;
  if (query?.sort === 'recent') sort = { updatedAt: -1 };
  else if (query?.sort === 'ageAsc') sort = { age: 1 };
  else if (query?.sort === 'ageDesc') sort = { age: -1 };

  const skip = (page - 1) * limit;
  return { page, limit, skip, sort };
}

/* ----------------------- Main runner ----------------------- */
/**
 * runDiscover(query, currentUserId, options)
 * - includeSelf: boolean (allow returning own profile)
 * - includeHidden: boolean (do not exclude hidden accounts)
 * - fields: optional projection
 *
 * Returns: { users, page, limit, total? } – total omitted for perf unless count=true
 */
export async function runDiscover(query, currentUserId, options = {}) {
  const {
    includeSelf = false,
    includeHidden = false,
    fields = '-password -passwordResetToken -passwordResetExpires -blockedUsers',
    count = false,
  } = options;

  // Build base filters
  let filters = buildDiscoverFilters(query, currentUserId, { allowSelf: includeSelf });
  filters = applyOptionalAgeFilter(filters, query);

  if (!includeHidden) {
    filters = { $and: [filters, hiddenExclusionClause(new Date())] };
  }

  // If includeSelf=true and includeHidden=false → explicitly allow visible self
  if (currentUserId && includeSelf && !includeHidden) {
    filters = {
      $and: [
        filters,
        {
          $or: [
            { _id: { $ne: currentUserId } },
            { $and: [{ _id: currentUserId }, hiddenExclusionClause(new Date())] },
          ],
        },
      ],
    };
  }

  // Paging & sort
  const { page, limit, skip, sort } = buildPagingAndSort(query);

  // Query
  let q = User.find(filters).select(fields).limit(limit).skip(skip).lean();
  if (sort) q = q.sort(sort);

  const [rows, total] = await Promise.all([
    q.exec(),
    count ? User.countDocuments(filters) : Promise.resolve(undefined),
  ]);

  const users = Array.isArray(rows) ? rows.map(normalizeUserDoc) : [];

  return {
    users,
    page,
    limit,
    ...(typeof total === 'number' ? { total } : {}),
  };
}

export default {
  ALLOWED_FILTERS,
  toNumberSafe,
  isTruthy,
  ciLike,
  normalizeImagePath,
  normalizeImageArray,
  normalizeUserDoc,
  hiddenExclusionClause,
  buildDiscoverFilters,
  applyOptionalAgeFilter,
  buildPagingAndSort,
  runDiscover,
};
// --- REPLACE END ---
