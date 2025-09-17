// File: server/routes/likes.js

// --- REPLACE START: Likes routes (ESM, auth protected) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';
// --- REPLACE START: lazy-load likes controller ---
let LikesCtrl = null;
async function getLikesCtrl() {
  if (LikesCtrl) return LikesCtrl;
  try {
    const mod = await import('../controllers/likesController.js');
    LikesCtrl = mod.default || mod;
  } catch (e) {
    LikesCtrl = {};
  }
  return LikesCtrl;
}
// --- REPLACE END ---

const router = express.Router();

/**
 * Mount examples (in app.js):
 *   import likesRoutes from './routes/likes.js';
 *   app.use('/api/likes', likesRoutes);
 */

// Create / remove a like
router.post('/:targetId', authenticate, async (req,res)=>{ const c=await getLikesCtrl(); return c.likeUser ? c.likeUser(req,res) : res.status(501).json({error:'likesController.likeUser not available'}); });
router.delete('/:targetId', authenticate, async (req,res)=>{ const c=await getLikesCtrl(); return c.unlikeUser ? c.unlikeUser(req,res) : res.status(501).json({error:'likesController.unlikeUser not available'}); });

// Lists
router.get('/outgoing', authenticate, async (req,res)=>{ const c=await getLikesCtrl(); return c.listOutgoingLikes ? c.listOutgoingLikes(req,res) : res.status(501).json({error:'likesController.listOutgoingLikes not available'}); });
router.get('/incoming', authenticate, async (req,res)=>{ const c=await getLikesCtrl(); return c.listIncomingLikes ? c.listIncomingLikes(req,res) : res.status(501).json({error:'likesController.listIncomingLikes not available'}); });
router.get('/matches',  authenticate, async (req,res)=>{ const c=await getLikesCtrl(); return c.listMatches ? c.listMatches(req,res) : res.status(501).json({error:'likesController.listMatches not available'}); });

// --- REPLACE END ---

export default router;
