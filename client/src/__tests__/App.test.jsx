// client/src/__tests__/App.test.jsx
import { render, screen } from "@testing-library/react";
import React from "react";
import App from "../App";

describe("App smoke test", () => {
  test("renders main heading", () => {
    render(<App />);
    // Oletetaan, että App:ssa on esim. <h1>Welcome to DateSite</h1>
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/Welcome to DateSite/i);
  });
});
