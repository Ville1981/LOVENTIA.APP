// File: client/src/tests/setupTests.ts

// --- REPLACE START: setup for Vitest + React Testing Library ---
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock react-router-dom navigation (prevents "Cannot read properties of undefined (reading 'push')" in tests)
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});
// --- REPLACE END ---
