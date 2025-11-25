// File: client/src/pages/MessagesOverview.jsx

import React from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";

import ConversationList from "../components/ConversationList";
import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";

/**
 * MessagesOverview page
 *
 * Renders the conversation overview list within the main layout.
 */
export default function MessagesOverview() {
  const { t } = useTranslation();

  // Resolve title/description with safe default values
  const title = t("chat:overview.title", {
    defaultValue: "Conversations",
  });

  const description = t("chat:overview.pageDescription", {
    defaultValue: "View and manage your conversations.",
  });

  return (
    <main className="p-6">
      {/* SEO / document head */}
      <Helmet>
        <title>{title} - MyApp</title>
        <meta name="description" content={description} />
      </Helmet>

      <header className="mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>

      <ConversationList />

      {/* // --- REPLACE START: standard content ad slot (inline) --- */}
      <AdGate type="inline" debug={false}>
        <div className="max-w-3xl mx-auto mt-6">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </div>
      </AdGate>
      {/* // --- REPLACE END --- */}
    </main>
  );
}



