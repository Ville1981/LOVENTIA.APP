// File: server/tests/fixtures/users.js

// --- REPLACE START ---
/**
 * Minimal seed users for discover filtering tests.
 * Adjust fields to match your User schema.
 */
export const USERS = [
  {
    _id: "65f000000000000000000001",
    username: "alice",
    gender: "female",
    age: 28,
    location: { type: "Point", coordinates: [24.9384, 60.1699] }, // Helsinki approx
    lifestyle: { smoke: "no", drink: "social", drugs: "no" },
    orientation: "straight",
    ideology: "liberal",
    profession: "designer",
    photos: [{ url: "/uploads/a1.jpg" }],
    premium: false,
  },
  {
    _id: "65f000000000000000000002",
    username: "bob",
    gender: "male",
    age: 35,
    location: { type: "Point", coordinates: [24.7536, 59.4370] }, // Tallinn approx
    lifestyle: { smoke: "occasionally", drink: "no", drugs: "no" },
    orientation: "straight",
    ideology: "moderate",
    profession: "engineer",
    photos: [{ url: "/uploads/b1.jpg" }],
    premium: true,
  },
  {
    _id: "65f000000000000000000003",
    username: "cora",
    gender: "female",
    age: 42,
    location: { type: "Point", coordinates: [25.7482, 62.2415] }, // Jyväskylä approx
    lifestyle: { smoke: "no", drink: "no", drugs: "no" },
    orientation: "gay",
    ideology: "conservative",
    profession: "teacher",
    photos: [{ url: "/uploads/c1.jpg" }],
    premium: false,
  },
];
// --- REPLACE END ---
