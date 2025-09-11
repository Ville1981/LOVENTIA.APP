// File: server/tests/userRoutes.test.js
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

jest.mock("../models/User");

describe("User Routes", () => {
  describe("GET /api/users/:id", () => {
    it("should return user if found", async () => {
      const mockUser = { _id: "1", username: "TestUser", email: "test@example.com" };
      User.findById = jest.fn().mockResolvedValue(mockUser);

      const res = await request(app)
        .get("/api/users/1")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(res.body).toHaveProperty("_id", "1");
      expect(res.body).toHaveProperty("username", "TestUser");
      expect(res.body).toHaveProperty("email", "test@example.com");
    });

    it("should return 404 if user not found", async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      const res = await request(app).get("/api/users/2").expect(404);

      expect(res.body).toHaveProperty("error", "User not found");
    });
  });

  describe("GET /api/discover", () => {
    it("should return a list of users with default filters", async () => {
      const mockUsers = [
        { _id: "1", username: "Alice", age: 25 },
        { _id: "2", username: "Bob", age: 30 },
      ];
      User.find = jest.fn().mockResolvedValue(mockUsers);

      const res = await request(app).get("/api/discover").expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty("username", "Alice");
    });

    it("should apply age filters correctly", async () => {
      const mockUsers = [{ _id: "3", username: "Charlie", age: 28 }];
      User.find = jest.fn().mockResolvedValue(mockUsers);

      const res = await request(app)
        .get("/api/discover?minAge=25&maxAge=30")
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].age).toBeGreaterThanOrEqual(25);
      expect(res.body[0].age).toBeLessThanOrEqual(30);
    });

    it("should return empty array if no users match filters", async () => {
      User.find = jest.fn().mockResolvedValue([]);

      const res = await request(app).get("/api/discover?minAge=80&maxAge=90").expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });
});
