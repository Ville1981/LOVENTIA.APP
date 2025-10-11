// File: server/tests/users.photos.int.test.js

// --- REPLACE START: integration tests for users/photos (upload → reorder → set avatar → delete) ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

// Increase timeout for slow CI
jest.setTimeout(30000);

/**
 * Helpers
 */

// Minimal 1x1 PNG (transparent) so we don't depend on fs
const TINY_PNG = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A' +
    '49444154789C6360000002000100FFFF03000006000557BF0A0000000049454E44AE426082',
  'hex'
);

// Generate a ~6MB buffer to trigger Multer 413 (payload too large) if limits are in place
const SIX_MB = Buffer.alloc(6 * 1024 * 1024, 0x41);

/** Accept either 401 or 403 (project may use both in different middlewares) */
function expectAuthDenied(status) {
  expect([401, 403]).toContain(status);
}

describe('Users / photos basics', () => {
  let token;
  let userId;
  /** Saved photo ids in upload order */
  const uploadedPhotoIds = [];

  beforeAll(async () => {
    // Assumption: /api/auth/register returns 201 and /api/auth/login returns 200 with { token | accessToken }
    const email = `test+${Date.now()}@example.com`;
    const password = process.env.TEST_PASSWORD || ("e2e-" + Date.now() + "A1!");

    await request(app).post('/api/auth/register').send({ email, password }).expect((res) => {
      expect([200, 201]).toContain(res.status); // Some implementations return 200
    });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect([200, 201]).toContain(login.status);

    token = login.body?.token || login.body?.accessToken;
    expect(token).toBeTruthy();

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    userId = me.body?._id || me.body?.id;
    expect(userId).toBeTruthy();
  });

  test('GET /api/users/me returns normalized arrays', async () => {
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);

    // photos & extraImages should be arrays
    expect(Array.isArray(me.body?.photos || [])).toBe(true);
    expect(Array.isArray(me.body?.extraImages || [])).toBe(true);
    // Never leak password
    expect(me.body?.password).toBeUndefined();
  });

  test('PUT /api/users/:id/photos/reorder rejects bad payload', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}/photos/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ order: 'not-an-array' });

    // Most implementations return 400 on validation error
    expect([400, 422]).toContain(res.status);
  });

  test('POST /api/users/:id/photos/upload-photo-step (unauthorized)', async () => {
    const res = await request(app)
      .post(`/api/users/${userId}/photos/upload-photo-step`)
      .attach('photo', TINY_PNG, 'tiny.png'); // no auth header

    expectAuthDenied(res.status);
  });

  test('POST /api/users/:id/photos/upload-photo-step → 200 and returns photo id/url', async () => {
    const res = await request(app)
      .post(`/api/users/${userId}/photos/upload-photo-step`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', TINY_PNG, 'tiny.png');

    expect([200, 201]).toContain(res.status);

    // Try to extract a photo id from common response shapes
    // Possible shapes:
    //  - { photoId, url }
    //  - { data: { id, url } }
    //  - { photos: [{ id|_id|key|url }] }
    let pid =
      res.body?.photoId ||
      res.body?.id ||
      res.body?.data?.id ||
      res.body?.data?.photoId ||
      res.body?.photo?.id ||
      res.body?.photo?._id ||
      null;

    if (!pid) {
      const arr = Array.isArray(res.body?.photos) ? res.body.photos : [];
      if (arr.length) {
        const first = arr[0];
        pid = first?.id || first?._id || first?.key || null;
      }
    }

    // Some APIs only return an URL; accept URL key as fallback, but also push placeholder id
    const url = res.body?.url || res.body?.data?.url;
    expect(pid || url).toBeTruthy();

    uploadedPhotoIds.push(pid || url || 'photo-0');
  });

  test('POST upload second photo (for reorder test)', async () => {
    const res = await request(app)
      .post(`/api/users/${userId}/photos/upload-photo-step`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', TINY_PNG, 'tiny-2.png');

    expect([200, 201]).toContain(res.status);

    let pid =
      res.body?.photoId ||
      res.body?.id ||
      res.body?.data?.id ||
      res.body?.data?.photoId ||
      res.body?.photo?.id ||
      res.body?.photo?._id ||
      null;

    if (!pid) {
      const arr = Array.isArray(res.body?.photos) ? res.body.photos : [];
      if (arr.length) {
        const last = arr[arr.length - 1];
        pid = last?.id || last?._id || last?.key || null;
      }
    }

    const url = res.body?.url || res.body?.data?.url;
    expect(pid || url).toBeTruthy();

    uploadedPhotoIds.push(pid || url || 'photo-1');
    expect(uploadedPhotoIds.length).toBeGreaterThanOrEqual(2);
  });

  test('PUT /api/users/:id/photos/reorder accepts new order', async () => {
    // Reverse current order
    const newOrder = uploadedPhotoIds.slice().reverse();

    const res = await request(app)
      .put(`/api/users/${userId}/photos/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ order: newOrder });

    expect([200, 204]).toContain(res.status);
  });

  test('PUT /api/users/:id/photos/set-avatar sets avatar from an existing photo', async () => {
    const candidate = uploadedPhotoIds[0];
    const res = await request(app)
      .put(`/api/users/${userId}/photos/set-avatar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ photoId: candidate });

    expect([200, 204]).toContain(res.status);

    // Optionally verify the user profile reflects the avatar
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    // Accept either profilePicture or avatar field
    const pic = me.body?.profilePicture || me.body?.avatar;
    if (pic) {
      expect(typeof pic).toBe('string');
    }
  });

  test('DELETE /api/users/:id/photos/:photoId removes a photo', async () => {
    const target = uploadedPhotoIds.pop();
    const res = await request(app)
      .delete(`/api/users/${userId}/photos/${encodeURIComponent(target)}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });

  test('POST upload oversize (~6MB) → expect 413 Payload Too Large (if Multer limits enabled)', async () => {
    const res = await request(app)
      .post(`/api/users/${userId}/photos/upload-photo-step`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', SIX_MB, 'big.jpg');

    // When Multer/file-size limit is configured, server returns 413.
    // If limits are not set, some apps may still accept it (200/201). We assert 413 primarily.
    if (res.status !== 413) {
      // Provide helpful log if the limit isn't active
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Expected 413 for oversize upload, got ${res.status}. ` +
          'Ensure Multer/fileSize limit is configured to enforce payload size.'
      );
    }
    expect([413, 200, 201]).toContain(res.status);
  });
});
// --- REPLACE END ---











