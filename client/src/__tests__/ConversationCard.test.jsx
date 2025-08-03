// File: src/__tests__/ConversationCard.test.jsx
import { render, screen } from "@testing-library/react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import React from "react";
import { I18nextProvider } from "react-i18next";
import ConversationCard from "../components/ConversationCard";
import i18n from "../utils/i18n"; // assume your i18n instance

describe("ConversationCard", () => {
  const data = {
    avatarUrl: "/img/avatar.jpg",
    displayName: "Bob",
    snippet: "Test message snippet",
    lastMessageTimestamp: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    unreadCount: 3,
  };

  it("renders avatar, name, snippet and unread badge", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ConversationCard data={data} />
      </I18nextProvider>
    );

    const img = screen.getByRole("img", { name: /bob's avatar/i });
    expect(img).toHaveAttribute("src", "/img/avatar.jpg");
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Test message snippet")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("formats time ago correctly", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ConversationCard data={data} />
      </I18nextProvider>
    );

    const expected = formatDistanceToNowStrict(
      parseISO(data.lastMessageTimestamp),
      { addSuffix: true }
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
