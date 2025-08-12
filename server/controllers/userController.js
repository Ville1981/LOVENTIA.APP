// --- REPLACE START: thin orchestrator controller that delegates to services ---
import 'dotenv/config';

// Models (jos tarvitsee jossain suoraan)
import * as UserModule from '../src/models/User.js';
const User = UserModule.default || UserModule;

// Centralized cookie options
import refreshCookieOptions from '../src/utils/cookieOptions.js';

// Services
import { registerUserService, loginUserService } from './services/auth.service.js';
import {
  getMeService,
  updateProfileService,
  getMatchesWithScoreService,
  upgradeToPremiumService,
} from './services/profile.service.js';
import {
  uploadExtraPhotosService,
  uploadPhotoStepService,
  deletePhotoSlotService,
} from './services/images.service.js';

// Controllers delegate suoraan palveluihin
export async function registerUser(req, res) {
  return registerUserService(req, res);
}

export async function loginUser(req, res) {
  return loginUserService(req, res, { refreshCookieOptions });
}

export async function getMe(req, res) {
  return getMeService(req, res);
}

export async function updateProfile(req, res) {
  return updateProfileService(req, res);
}

export async function upgradeToPremium(req, res) {
  return upgradeToPremiumService(req, res);
}

export async function getMatchesWithScore(req, res) {
  return getMatchesWithScoreService(req, res);
}

export async function uploadExtraPhotos(req, res) {
  return uploadExtraPhotosService(req, res);
}

export async function uploadPhotoStep(req, res) {
  return uploadPhotoStepService(req, res);
}

export async function deletePhotoSlot(req, res) {
  return deletePhotoSlotService(req, res);
}

// Default export
export default {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  upgradeToPremium,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
};
// --- REPLACE END ---
