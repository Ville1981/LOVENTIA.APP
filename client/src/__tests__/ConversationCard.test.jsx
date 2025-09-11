// File: client/src/__tests__/ConversationCard.test.jsx

// --- REPLACE START ---
// Keep RTL matchers available in Vitest
import "@testing-library/jest-dom";
import React from "react";
import { screen, within } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";

// ✅ Minimal i18n shim so components using useTranslation() won’t crash in tests
// (Alternative to wrapping with I18nextProvider for this specific test file)
// IMPORTANT: mock BEFORE importing the component under test
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k) => (typeof k === "string" ? k : String(k)), // identity translator
    i18n: { changeLanguage: vi.fn().mockResolvedValue() },
  }),
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
}));

// SUT
import ConversationCard from "../components/ConversationCard.jsx";

// Use the shared router-aware renderer so <Link> inside the card works.
import { renderWithRouter } from "./utils/renderWithRouter";

describe("ConversationCard", () => {
  it("renders avatar, name, snippet and unread badge", () => {
    const convo = {
      peerAvatarUrl: "https://example.com/a.jpg",
      peerName: "Alice",
      lastMessage: "Hey there!",
      lastMessageTimestamp: "2023-01-01T12:00:00.000Z",
      unreadCount: 3,
      userId: "u1",
    };

    renderWithRouter(<ConversationCard convo={convo} />);

    // Narrow queries to this card only to avoid collisions when multiple cards exist in DOM
    const card = screen.getByTestId("conversation-card-link");
    const scoped = within(card);

    // Name
    expect(scoped.getByText("Alice")).toBeInTheDocument();
    // Snippet
    expect(scoped.getByText("Hey there!")).toBeInTheDocument();
    // Unread badge (exact '3' inside this card)
    expect(scoped.getByText("3")).toBeInTheDocument();

    // Avatar alt text scoped to the card as well
    expect(
      scoped.getByRole("img", { name: /alice.*avatar/i })
    ).toBeInTheDocument();
  });

  it("formats time ago correctly", () => {
    const now = new Date("2023-01-01T12:05:00.000Z");
    const convo = {
      peerName: "Bob",
      lastMessage: "Yo!",
      lastMessageTimestamp: "2023-01-01T12:00:00.000Z",
      unreadCount: 0,
      userId: "u2",
    };

    // Freeze time for a deterministic assertion
    vi.useFakeTimers();
    vi.setSystemTime(now);

    renderWithRouter(<ConversationCard convo={convo} />);

    // Scope to this specific card
    const card = screen.getByTestId("conversation-card-link");
    const scoped = within(card);

    // Expect something like "5 minutes ago" (exact wording depends on the utility used)
    expect(scoped.getByText(/5.*minute.*ago/i)).toBeInTheDocument();

    // Restore timers
    vi.useRealTimers();
  });
});
// --- REPLACE END ---
