// src/api/routes/socialRoutes.js

import express from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';
import { EventShareService } from '../services/EventShareService.js';

const router = express.Router();

/**
 * Hakee Instagram-feedin backendin kautta
 */
router.get('/social/instagram/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const { count } = req.query;
    // Esimerkki: proxy IG API-kutsu (vaatii tokenin)
    const response = await axios.get(`https://graph.instagram.com/${username}/media`, {
      params: { access_token: process.env.IG_TOKEN, limit: count },
    });
    res.json(response.data.data);
  } catch (err) {
    next(err);
  }
});

/**
 * Hakee Spotify-soittolistan backendin kautta
 */
router.get('/social/spotify/:playlistId', async (req, res, next) => {
  try {
    const { playlistId } = req.params;
    const { count } = req.query;
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: { Authorization: `Bearer ${process.env.SPOTIFY_TOKEN}` },
      params: { limit: count },
    });
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
 * Jakaa paikallisen tapahtuman
 */
router.post('/social/event', auth, async (req, res, next) => {
  try {
    const eventData = req.body;
    const event = await EventShareService.shareEvent(req.user.id, eventData);
    res.status(201).json({ success: true, event });
  } catch (err) {
    next(err);
  }
});

export default router;
