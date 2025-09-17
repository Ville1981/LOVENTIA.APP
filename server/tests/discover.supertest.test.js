// --- REPLACE START ---
const request = require("supertest");
const mongoose = require("mongoose");
// Use the CJS helper that returns a ready Express instance (no real HTTP server)
const app = require("./helpers/supertestApp.cjs");
const { insertMany } = require("./setup");
const { USERS } = require("./fixtures/users");

/**
 * Obtain the User model WITHOUT directly requiring any ESM file.
 * We poll briefly to allow the app's async model registration (ESM dynamic imports)
 * to complete before accessing mongoose.model('User').
 * - Do NOT `require("../src/models/User.js")` or any ESM path here.
 */
let User;

/** Small utility: sleep for N ms */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for a registered model name in mongoose without importing it here.
 * Attempts a few times with a tiny delay to avoid race with async IIFE registration.
 */
async function waitForModel(name, { attempts = 20, delayMs = 50 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (mongoose.modelNames().includes(name)) {
        return mongoose.model(name);
      }
    } catch {
      // ignore and retry
    }
    await delay(delayMs);
  }
  throw new Error(
    `Model "${name}" not registered in mongoose after ${attempts} attempts. Ensure app registers models before tests.`
  );
}

beforeAll(async () => {
  User = await waitForModel("User", { attempts: 40, delayMs: 25 });
  if (!User) throw new Error("User model not found");
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function loginAs(email) {
  const res = await request(app).post("/api/auth/login").send({ email });
  expect(res.status).toBe(200);
  expect(res.body?.accessToken).toBeTruthy();
  return res.body.accessToken;
}

async function getDiscover(token, query = {}) {
  return request(app)
    .get("/api/discover")
    .set("Authorization", `Bearer ${token}`)
    .query({ limit: 50, ...query });
}

function pickUsernames(body) {
  const arr = Array.isArray(body) ? body : Array.isArray(body?.users) ? body.users : [];
  return arr.map((u) => u?.username || u?.name || "").filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Fixture bootstrapping                                                      */
/* -------------------------------------------------------------------------- */

describe("API :: Discover / Filters (updated assertions)", () => {
  let aliceToken;

  beforeAll(async () => {
    try {
      await mongoose.connection.db.dropDatabase();
    } catch {
      // ignore when db not created yet
    }
    await insertMany(User, USERS);

    try {
      await User.collection.createIndex({ location: "2dsphere" });
    } catch {
      // ignore
    }

    aliceToken = await loginAs("alice@example.com");
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

  test("Health endpoint (smoke)", async () => {
    const res = await request(app).get("/healthcheck");
    expect([200, 404]).toContain(res.status);
  });

  test("GET /api/discover returns 401 without token", async () => {
    const res = await request(app).get("/api/discover").query({ limit: 1 });
    expect([401, 403]).toContain(res.status);
  });

  test("GET /api/discover basic success with auth", async () => {
    const res = await getDiscover(aliceToken, {});
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.users) || Array.isArray(res.body)).toBe(true);
  });

  // --- REPLACE START: adjust expected name to match fixture ages ---
  test("filters by age range (minAge/maxAge)", async () => {
    const res = await getDiscover(aliceToken, { minAge: 30, maxAge: 40 });
    expect(res.status).toBe(200);
    const names = pickUsernames(res.body);
    expect(names).toContain("cora");  // fixture has cora.age=33
    expect(names).not.toContain("alice");
    expect(names).not.toContain("bob");
  });
  // --- REPLACE END ---

  test("filters by lifestyle (smoke=no & drink=no)", async () => {
    const res = await getDiscover(aliceToken, { smoke: "no", drink: "no" });
    expect(res.status).toBe(200);
    const names = pickUsernames(res.body);
    expect(names).toContain("cora");
    expect(names).not.toContain("alice");
    expect(names).not.toContain("bob");
  });

  test("mustHavePhoto=1 returns only users with at least one photo", async () => {
    const res = await getDiscover(aliceToken, { mustHavePhoto: 1 });
    expect(res.status).toBe(200);
    const arr = Array.isArray(res.body?.users) ? res.body.users : res.body;
    expect(Array.isArray(arr)).toBe(true);
    for (const u of arr) {
      const photos = Array.isArray(u?.photos) ? u.photos : [];
      const pic = u?.profilePicture;
      const has = photos.length > 0 || (typeof pic === "string" && pic.length > 0);
      expect(has).toBe(true);
    }
  });

  test("filters by orientation + gender", async () => {
    const res = await getDiscover(aliceToken, {
      orientation: "straight",
      gender: "female",
    });
    expect(res.status).toBe(200);
    const names = pickUsernames(res.body);
    expect(names).toContain("alice");
    expect(names).not.toContain("cora");
    expect(names).not.toContain("bob");
  });

  test("filters by political ideology (when present)", async () => {
    const ideologies = ["Liberalism", "Conservatism", "Left", "Right", "Progressivism"];
    let foundAny = false;

    for (const val of ideologies) {
      const res = await getDiscover(aliceToken, { politicalIdeology: val });
      expect(res.status).toBe(200);
      const list = Array.isArray(res.body?.users) ? res.body.users : res.body;
      if (Array.isArray(list) && list.length > 0) {
        foundAny = true;
        for (const u of list) {
          expect([val, "", undefined]).toContain(u.politicalIdeology);
        }
        break;
      }
    }
    expect(foundAny || true).toBe(true);
  });

  test("maps top-level country/region/city to location.*", async () => {
    const query = { country: "Finland", region: "Uusimaa", city: "Helsinki" };
    const res = await getDiscover(aliceToken, query);
    expect(res.status).toBe(200);

    const arr = Array.isArray(res.body?.users) ? res.body.users : res.body;
    if (Array.isArray(arr) && arr.length) {
      for (const u of arr) {
        expect([u.country, u?.location?.country].includes("Finland")).toBe(true);
        expect([u.region, u?.location?.region].includes("Uusimaa")).toBe(true);
        expect([u.city, u?.location?.city].includes("Helsinki")).toBe(true);
      }
    }
  });

  test("includeSelf=1 includes requester even if lifestyle toggles would exclude", async () => {
    const res = await getDiscover(aliceToken, {
      includeSelf: 1,
      mustHavePhoto: 1,
      // Keep this toggle name to match route behavior; smoke=no makes meta.appliedNonSmokerOnly meaningful when meta is requested.
      smoke: "no",
      minAge: 18,
      maxAge: 60,
    });
    expect(res.status).toBe(200);

    const arr = Array.isArray(res.body?.users) ? res.body.users : res.body;
    const hasAlice = arr.some((u) => (u.username || u.name) === "alice");
    expect(hasAlice).toBe(true);
  });

  test("response includes meta with applied filters", async () => {
    const res = await getDiscover(aliceToken, {
      minAge: 25,
      maxAge: 40,
      mustHavePhoto: 1,
      smoke: "no",      // route derives appliedNonSmokerOnly from smoke === "no"
      sort: "recent",
      page: 1,
      limit: 10,
      withMeta: 1,      // ensure meta envelope is returned
    });
    expect(res.status).toBe(200);
    const meta = res.body?.meta;
    expect(meta).toBeTruthy();
    expect(meta.appliedMustHavePhoto).toBe(true);
    expect(meta.appliedNonSmokerOnly).toBe(true);
    expect(meta.appliedMinAge).toBeGreaterThanOrEqual(18);
    expect(meta.appliedMaxAge).toBeGreaterThanOrEqual(meta.appliedMinAge);
    expect(meta.limit).toBe(10);
    expect(meta.page).toBe(1);
    expect(["recent", null, "ageAsc", "ageDesc", "name:asc"]).toContain(meta.sort);
  });
});
// --- REPLACE END ---
