const request = require("supertest");

const base = process.env.TEST_BASE || `http://localhost:${process.env.PORT||5000}`;

describe("Server smoke", () => {
  it("GET /health returns OK", async () => {
    const res = await request(base).get("/health");
    expect([200,204]).toContain(res.status);
    expect((res.text||"").toUpperCase()).toContain("OK");
  });
});

describe("Auth flow", () => {
  const ts = Date.now();
  const username = `alice_${ts}`;                   //  uniikki käyttäjänimi
  const email = `alice.${ts}@example.com`;         //  uniikki email
  const password = "Secret123!";
  let accessToken = null;

  it("POST /api/auth/register creates user", async () => {
    const res = await request(base)
      .post("/api/auth/register")
      .send({ username, email, password })
      .set("Content-Type","application/json");

    // Jos epäonnistuu, näytä response body helpomman diagnosoinnin vuoksi
    if (![200,201].includes(res.status)) {
      // tulostus auttaa kun testit epäonnistuvat CI:ssä
      // eslint-disable-next-line no-console
      console.error("Register failed:", res.status, res.body || res.text);
    }

    expect([200,201]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
  });

  it("POST /api/auth/login returns accessToken", async () => {
    const res = await request(base)
      .post("/api/auth/login")
      .send({ email, password })
      .set("Content-Type","application/json");

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error("Login failed:", res.status, res.body || res.text);
    }

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    accessToken = res.body.accessToken;
  });

  it("GET /api/auth/me works with Bearer token", async () => {
    const res = await request(base)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error("ME failed:", res.status, res.body || res.text);
    }

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
  });
});
