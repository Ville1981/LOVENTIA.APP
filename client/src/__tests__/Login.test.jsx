// File: client/src/__tests__/Login.test.jsx

// --- REPLACE START ---
// Ensure RTL matchers are available
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { describe, it, expect, vi, beforeEach } from "vitest";
import i18n from "../i18n";
import Login from "../pages/Login.jsx";

/**
 * Centralized stubs (router/i18n/polyfills) live in client/src/setupTests.js,
 * so we avoid per-file i18n/router mocks to prevent hoisting issues.
 *
 * We only mock AuthContext to control the login() behavior per test.
 */
vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from "../contexts/AuthContext";

/**
 * Local render helper to replace the broken renderWithProviders import.
 * Wraps components with i18n + router so tests don't depend on global setup.
 */
function renderWithProviders(ui, { route = "/" } = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </I18nextProvider>
  );
}

/**
 * Helper: scope queries to the first visible Login card to avoid collisions
 * when multiple forms exist in the document.
 */
function getLoginScope() {
  // Find a "Log In" heading or fallback to the first <form>
  const heading =
    screen.queryByRole("heading", { name: /log in/i }) ||
    screen.getAllByRole("heading", { level: 2 }).find((el) =>
      /log in/i.test(el.textContent || "")
    );

  const container =
    heading?.closest("section,div,form") ||
    screen.queryAllByRole("form")[0] ||
    document.body;

  return within(container);
}

describe("Login Page", () => {
  const loginMock = vi.fn();

  beforeEach(() => {
    // Provide the mocked login() to the component under test
    useAuth.mockReturnValue({
      login: loginMock,
    });
    loginMock.mockReset();
  });

  it("renders email, password and submit button", () => {
    renderWithProviders(<Login />);

    const scoped = getLoginScope();
    expect(scoped.getByLabelText(/email/i)).toBeInTheDocument();
    expect(scoped.getByLabelText(/password/i)).toBeInTheDocument();
    expect(scoped.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("logs in successfully and shows success message", async () => {
    // Resolve to indicate success
    loginMock.mockResolvedValue(undefined);

    renderWithProviders(<Login />);

    const scoped = getLoginScope();

    fireEvent.change(scoped.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(scoped.getByLabelText(/password/i), {
      target: { value: "pass" },
    });

    fireEvent.click(scoped.getByRole("button", { name: /log in/i }));

    // Assert AuthContext.login was called with email & password
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("a@b.com", "pass");
    });

    // The page should render a success indicator (text may be translated; accept key or text)
    const success =
      screen.queryByText(/login successful!/i) ||
      screen.queryByText(/login:success/i) ||
      screen.queryByRole("status");
    expect(success).toBeTruthy();
  });

  it("shows error message when login fails", async () => {
    loginMock.mockRejectedValue(new Error("Invalid credentials"));

    renderWithProviders(<Login />);

    const scoped = getLoginScope();

    fireEvent.change(scoped.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(scoped.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });

    fireEvent.click(scoped.getByRole("button", { name: /log in/i }));

    // Error message from rejection should be visible
    await waitFor(() => {
      const err =
        screen.queryByText(/invalid/i) ||
        screen.queryByText(/error/i) ||
        screen.queryByRole("alert");
      expect(err).toBeTruthy();
    });
  });
});
// --- REPLACE END ---
















