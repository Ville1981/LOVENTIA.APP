// File: client/src/__tests__/App.test.jsx
// --- REPLACE START ---
// Ensure jest-dom matchers are available in Vitest environment
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import App from "../App.jsx";

// Load the app's i18n so useTranslation() has a real instance.
// Adjust the path if your project structure differs.
import "../i18n.js";

describe("App smoke test", () => {
  it("renders at least one level-1 heading", async () => {
    render(<App />);
    // Multiple <h1> elements are expected (navbar/hero/page). Accept any.
    const headings = await screen.findAllByRole("heading", { level: 1 });
    expect(headings.length).toBeGreaterThan(0);
  });
});
// --- REPLACE END ---
