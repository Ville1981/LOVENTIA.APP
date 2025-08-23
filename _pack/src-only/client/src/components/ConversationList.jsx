// File: src/components/ConversationList.jsx
import { useQuery } from "@tanstack/react-query";
import React from "react";
// --- REPLACE START: import bunnyUser fallback data ---
import { useTranslation } from "react-i18next";

import ConversationCard from "./ConversationCard";
import styles from "./ConversationList.module.css";
import ErrorState from "./ErrorState";
import Spinner from "./Spinner";
import bunnyUser from "../data/bunnyUser";
// --- REPLACE END ---
import axios from "../utils/axiosInstance";

/**
 * ConversationList component
 *
 * Fetches the list of conversations and handles loading, error, and empty states.
 * Uses CSS module for layout and consistent styling.
 */
export default function ConversationList() {
  const { t } = useTranslation();

  const {
    data: conversations,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["conversationsOverview"],
    queryFn: () => axios.get("/api/messages/overview").then((res) => res.data),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className={styles.loading} aria-busy="true">
        <Spinner />
        <p>{t("chat:overview.loading", "Loading conversations…")}</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.error} role="alert">
        <ErrorState
          message={
            error.response?.data?.message ||
            t("chat:overview.error", "Unable to load conversations.")
          }
        />
      </section>
    );
  }

  // --- REPLACE START: display bunny placeholder card on empty state ---
  if (!conversations || conversations.length === 0) {
    return (
      <section
        className={styles.empty}
        aria-label={t("chat:overview.title", "Conversations")}
      >
        <h2 className="sr-only">{t("chat:overview.title", "Conversations")}</h2>
        <ConversationCard convo={bunnyUser} />
      </section>
    );
  }
  // --- REPLACE END ---

  return (
    <section
      className={styles.list}
      aria-label={t("chat:overview.title", "Conversations")}
    >
      <h2 className="text-xl font-semibold mb-4">
        {t("chat:overview.title", "Conversations")}
      </h2>
      {conversations.map((convo) => (
        <ConversationCard key={convo.userId} convo={convo} />
      ))}
    </section>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.
