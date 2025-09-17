// server/tests/userRoutes.test.js

// --- REPLACE START: align tests with STRICT auth and dual response shape ({ users } or plain array) ---
/**
 * Mock the User model BEFORE it's required anywhere.
 * IMPORTANT:
 *  - The factory returns an object that ALREADY has `find` and `findById` as jest.fn.
 *  - It also exposes `estimatedDocumentCount` and `countDocuments` defaulting to 2,
 *    so the route does NOT fall back to seed when `find()` returns an empty list.
 *  - We expose both the CommonJS root export and the `default` export pointing
 *    to the same mutable object so the app's `require("../models/User")`
 *    (which reads `.default || .User || module`) will see our spies.
 */
jest.mock("../models/User", () => {
  const model = {
    find: jest.fn(async () => []),
    findById: jest.fn(async () => null),
    estimatedDocumentCount: jest.fn(async () => 2),
    countDocuments: jest.fn(async () => 2),
  };
  return {
    __esModule: true,
    default: model,
    ...model, // allow root-level access too
  };
});

const request = require("supertest");
// Load the Express app via the CJS helper that resolves the ESM app.
// This returns a ready Express instance (not a Promise).
const app = require("./helpers/supertestApp.cjs");

// Use the mocked module (the object returned by jest.mock above)
const User = require("../models/User");

async function loginAs(email = "test@example.com") {
  const res = await request(app).post("/api/auth/login").send({ email });
  expect(res.status).toBe(200);
  expect(res.body?.accessToken).toBeTruthy();
  return res.body.accessToken;
}

/**
 * Legacy helpers kept for reference (NOT used anymore).
 * We now prefer `User.find.mockResolvedValue(...)` and
 * `User.findById.mockResolvedValue(...)` to avoid replacing fn references.
 * (Left here intentionally to maintain close line count and future debugging.)
 */
// eslint-disable-next-line no-unused-vars
function setUserFindSpies(impl) {
  // DEPRECATED: do not reassign User.find; use mockResolvedValue instead.
  User.find.mockImplementation(impl);
}
// eslint-disable-next-line no-unused-vars
function setUserFindByIdSpies(impl) {
  // DEPRECATED: do not reassign User.findById; use mockResolvedValue instead.
  User.findById.mockImplementation(impl);
}

// Reset mocks between tests to avoid leakage
beforeEach(() => {
  jest.clearAllMocks();
});

// Small parsing helper to accept both response shapes:
// - { users: [...] } OR plain array [...]
function pickList(body) {
  return Array.isArray(body?.users) ? body.users : body;
}

describe("User Routes", () => {
  describe("GET /api/users/:id", () => {
    it("should return user if found", async () => {
      const mockUser = { _id: "1", username: "TestUser", email: "test@example.com" };
      // Prefer direct mockResolvedValue to avoid any race with factory
      User.findById.mockResolvedValue(mockUser);

      const res = await request(app)
        .get("/api/users/1")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(res.body).toHaveProperty("_id", "1");
      expect(res.body).toHaveProperty("username", "TestUser");
      expect(res.body).toHaveProperty("email", "test@example.com");
    });

    it("should return 404 if user not found", async () => {
      User.findById.mockResolvedValue(null);

      const res = await request(app).get("/api/users/2").expect(404);

      expect(res.body).toHaveProperty("error", "User not found");
    });
  });

  describe("GET /api/discover", () => {
    let token;
    beforeAll(async () => {
      token = await loginAs("alice@example.com");
    });

    it("should return a list of users with default filters", async () => {
      const mockUsers = [
        { _id: "1", username: "Alice", age: 25 },
        { _id: "2", username: "Bob", age: 30 },
      ];
      // Ensure route uses our mocked results (no seed fallback)
      User.find.mockResolvedValue(mockUsers);

      const res = await request(app)
        .get("/api/discover")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const list = pickList(res.body);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(2);
      expect(list[0]).toHaveProperty("username", "Alice");
    });

    it("should apply age filters correctly", async () => {
      const mockUsers = [{ _id: "3", username: "Charlie", age: 28 }];
      User.find.mockResolvedValue(mockUsers);

      const res = await request(app)
        .get("/api/discover?minAge=25&maxAge=30")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const list = pickList(res.body);
      expect(list.length).toBe(1);
      expect(list[0].age).toBeGreaterThanOrEqual(25);
      expect(list[0].age).toBeLessThanOrEqual(30);
    });

    it("should return empty array if no users match filters", async () => {
      User.find.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/discover?minAge=80&maxAge=90")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const list = pickList(res.body);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });
  });
});
// --- REPLACE END ---
