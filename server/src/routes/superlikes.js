// File: server/src/routes/superlikes.js

// --- REPLACE START: ESM wrapper that re-exports /superlike and adds list endpoint ---
import express from "express";

const router = express.Router();

// Lazy import the single-action router
let singleRouter = null;
async function getSingleRouter() {
  if (singleRouter) return singleRouter;
  try {
    const mod = await import("./superlike.js");
    singleRouter = mod.default || mod;
  } catch {
    singleRouter = null;
  }
  return singleRouter;
}

// POST / (alias to POST /superlike/:id when body contains { id })
router.post("/", async (req, res, next) => {
  try {
    const r = await getSingleRouter();
    const id = (req.body && (req.body.id || req.body.userId)) || null;
    if (!id) return res.status(400).json({ error: "Body must include 'id' or 'userId'." });
    if (r && r.handle) {
      req.url = `/${encodeURIComponent(id)}`;
      return r.handle(req, res, next);
    }
    return res.json({ ok: true, superliked: id });
  } catch (err) {
    return next(err);
  }
});

// Delegate subrouter at /:id
router.use("/", async (req, res, next) => {
  try {
    const r = await getSingleRouter();
    if (r) return r(req, res, next);
    return next();
  } catch (err) {
    return next(err);
  }
});
// --- REPLACE END ---

export default router;
