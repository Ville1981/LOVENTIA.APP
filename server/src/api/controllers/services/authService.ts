// src/services/authService.ts
import axios from 'axios';

export async function refreshToken() {
  return axios.post(
    '/api/auth/refresh',
    {},
    { withCredentials: true }
  );
}
