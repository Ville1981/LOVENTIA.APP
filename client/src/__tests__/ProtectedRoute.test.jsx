// File: client/src/__tests__/ProtectedRoute.test.jsx

// --- REPLACE START ---
import "@testing-library/jest-dom"; // use base package (works with Vitest)
import React from "react";
import { Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { within } from "@testing-library/react";
import ProtectedRoute from "../components/ProtectedRoute.jsx";

// Use the shared router-aware renderer and re-exported screen
import { renderWithRouter, screen } from "./utils/renderWithRouter";

// Mock AuthContext to align with current ProtectedRoute API ({ user, bootstrapped })
vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from "../contexts/AuthContext";

// Simple placeholder components for test routes
function Protected() {
  return <div>Protected Content</div>;
}
function LoginPage() {
  return <div>Login Page</div>;
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it("redirects to /login when user is null and bootstrapped is true", () => {
    useAuth.mockReturnValue({ user: null, bootstrapped: true });

    const { container } = renderWithRouter(
      <Routes>
        {/* Route for login must exist to handle redirect */}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <Protected />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/protected"] }
    );

    // Scope queries to this render to avoid bleed from other tests/suites
    const scoped = within(container);

    expect(scoped.getByText("Login Page")).toBeInTheDocument();
    expect(scoped.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders children when user exists and bootstrapped is true", () => {
    useAuth.mockReturnValue({ user: { id: "x" }, bootstrapped: true });

    const { container } = renderWithRouter(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <Protected />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ["/protected"] }
    );

    // Scope queries to this render to avoid any stray 'Login Page' from other DOMs
    const scoped = within(container);

    expect(scoped.getByText("Protected Content")).toBeInTheDocument();
    expect(scoped.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
// --- REPLACE END ---
