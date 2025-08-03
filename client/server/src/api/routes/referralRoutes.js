// src/api/routes/referralRoutes.js

import express from 'express';
import {
  createReferral,
  getReferralStatus,
  listReferrals
} from '../controllers/ReferralController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/**
 * Luo uuden referral-linkin nykyiselle käyttäjälle
 */
router.post('/referral', auth, createReferral);

/**
 * Hakee referral-statuksen referral-koodilla
 */
router.get('/referral/:code', getReferralStatus);

/**
 * Listaa kaikki referral-linkit kirjautuneelle käyttäjälle
 */
router.get('/referrals', auth, listReferrals);

export default router;
