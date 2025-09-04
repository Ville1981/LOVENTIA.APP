// File: server/routes/likes.js

// --- REPLACE START: Likes routes (ESM, auth protected) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  likeUser,
  unlikeUser,
  listOutgoingLikes,
  listIncomingLikes,
  listMatches,
} from '../controllers/likesController.js';

const router = express.Router();

/**
 * Mount examples (in app.js):
 *   import likesRoutes from './routes/likes.js';
 *   app.use('/api/likes', likesRoutes);
 */

// Create / remove a like
router.post('/:targetId', authenticate, likeUser);
router.delete('/:targetId', authenticate, unlikeUser);

// Lists
router.get('/outgoing', authenticate, listOutgoingLikes);
router.get('/incoming', authenticate, listIncomingLikes);
router.get('/matches',  authenticate, listMatches);

export default router;
// --- REPLACE END ---
