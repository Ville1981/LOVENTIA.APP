// File: client/src/components/ConversationList.jsx

import { useQuery } from "@tanstack/react-query";
import React from "react";
// --- REPLACE START: imports for ConversationList (no bunny demo data) ---
import { useTranslation } from "react-i18next";

import ConversationCard from "./ConversationCard";
import styles from "./ConversationList.module.css";
import ErrorState from "./ErrorState";
import Spinner from "./Spinner";
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

  // Normalisoidaan backendin palauttama data:
  // - tukee sekä [] että { conversations: [] }
  // - rikastetaan partnerId / partnerEmail / partnerUsername + premium-metadatalla,
  //   mutta ei rikota nykyistä muotoa (palautetaan ...item + lisäkentät).
  const normalizedConversations = React.useMemo(() => {
    if (!conversations) return [];

    let arr = conversations;

    // Tulevaisuutta varten: jos backend joskus palauttaa { conversations: [...] }
    if (!Array.isArray(arr) && Array.isArray(conversations?.conversations)) {
      arr = conversations.conversations;
    }

    if (!Array.isArray(arr)) return [];

    return arr.map((item) => {
      const entitlements = item.entitlements || {};
      const isPremium =
        item.isPremium ??
        item.premium ??
        (entitlements && entitlements.tier === "premium") ??
        false;

      const emailLike =
        item.partnerEmail || item.email || item.userEmail || "";

      return {
        ...item,
        // Partneri/id jonka kanssa keskustellaan – fallback järjestys:
        partnerId: item.partnerId ?? item.userId ?? item._id,
        // Sähköposti jos löytyy jostain:
        partnerEmail: item.partnerEmail ?? item.email ?? item.userEmail ?? null,
        // Nimi/esitys:
        partnerUsername:
          item.partnerUsername ??
          item.username ??
          item.name ??
          (emailLike ? emailLike.split("@")[0] : ""),
        // Premium-metat:
        premium: item.premium ?? isPremium,
        isPremium,
        entitlements,
      };
    });
  }, [conversations]);

  if (isLoading) {
    return (
      <section className={styles.loading} aria-busy="true">
        <Spinner />
        <p>
          {t("chat:overview.loading", {
            defaultValue: "Loading conversations…",
          })}
        </p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.error} role="alert">
        <ErrorState
          message={
            error?.response?.data?.message ||
            t("chat:overview.error", {
              defaultValue: "Unable to load conversations.",
            })
          }
        />
      </section>
    );
  }

  // --- REPLACE START: neutral empty-state text (no Bunny placeholder card) ---
  if (!normalizedConversations || normalizedConversations.length === 0) {
    return (
      <section
        className={styles.empty}
        aria-label={t("chat:overview.title", {
          defaultValue: "Conversations",
        })}
      >
        <h2 className="sr-only">
          {t("chat:overview.title", { defaultValue: "Conversations" })}
        </h2>
        <p className="text-gray-600 text-sm">
          {t("chat:overview.empty", {
            defaultValue:
              "No conversations yet. When you match and start messaging, your conversations will appear here.",
          })}
        </p>
      </section>
    );
  }
  // --- REPLACE END ---

  return (
    <section
      className={styles.list}
      aria-label={t("chat:overview.title", {
        defaultValue: "Conversations",
      })}
    >
      <h2 className="text-xl font-semibold mb-4">
        {t("chat:overview.title", { defaultValue: "Conversations" })}
      </h2>
      {normalizedConversations.map((convo) => (
        <ConversationCard
          key={convo.partnerId || convo.userId}
          convo={convo}
        />
      ))}
    </section>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.


