// --- REPLACE START: convert ESM to CommonJS and fix paths; keep logic intact ---
'use strict';

const express = require('express');
const axios = require('axios');
// Use the centralized authenticate middleware under server/src/middleware
const authenticate = require('../../middleware/authenticate.js');
// EventShareService lives under controllers/services
const { EventShareService } = require('../controllers/services/EventShareService.js');

const router = express.Router();

/**
 * Fetch Instagram feed via backend proxy
 */
router.get('/social/instagram/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const { count } = req.query;
    // Example proxy call (requires a valid token)
    const response = await axios.get(
      `https://graph.instagram.com/${username}/media`,
      { params: { access_token: process.env.IG_TOKEN, limit: count } }
    );
    res.json(response.data.data);
  } catch (err) {
    next(err);
  }
});

/**
 * Fetch Spotify playlist via backend proxy
 */
router.get('/social/spotify/:playlistId', async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    const { count } = req.query;
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: { Authorization: `Bearer ${process.env.SPOTIFY_TOKEN}` },
        params: { limit: count },
      }
    );
    const tracks = response.data.items.map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(', '),
      albumArt: item.track.album.images[0]?.url,
      link: item.track.external_urls.spotify,
    }));
    res.json(tracks);
  } catch (err) {
    next(err);
  }
});

/**
 * Share a local event
 */
router.post('/social/event', authenticate, async (req, res, next) => {
  try {
    const eventData = req.body;
    const event = await EventShareService.shareEvent(req.user.id, eventData);
    res.status(201).json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// --- REPLACE END ---
