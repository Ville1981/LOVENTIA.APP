// File: client/src/components/ConversationList.jsx

import { useQuery } from "@tanstack/react-query";
import React from "react";
// --- REPLACE START: imports for ConversationList (no bunny demo data) ---
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

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
  const params = useParams();

  // Active conversation id (used when this list is rendered on a route like /chat/:userId)
  const activeUserId = params?.userId ? String(params.userId) : null;

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

  // --- REPLACE START: fetch block list to filter blocked peers from conversations ---
  const {
    data: blockData,
    // We intentionally do not surface block loading/error in this UI;
    // if the block API fails, conversations are simply unfiltered.
    isLoading: isBlocksLoading, // reserved for future use (e.g. combined loading state)
    isError: isBlocksError, // reserved for future debug/logging if needed
  } = useQuery({
    queryKey: ["blocksOverview"],
    queryFn: () => axios.get("/api/block").then((res) => res.data),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const blockedIds = React.useMemo(() => {
    if (!blockData) return [];

    // Support multiple backend shapes:
    // 1) { items: [...] }
    // 2) { users: [...] }
    // 3) [ ... ] (array directly)
    let items = [];

    if (Array.isArray(blockData.items)) {
      items = blockData.items;
    } else if (Array.isArray(blockData.users)) {
      items = blockData.users;
    } else if (Array.isArray(blockData)) {
      items = blockData;
    }

    if (!items.length) return [];

    const ids = [];

    for (const b of items) {
      const candidate =
        b.blockedUserId ??
        b.targetUserId ??
        b.targetId ??
        b.blockedId ??
        b.userId ??
        b.id ??
        b._id ??
        null;

      if (candidate != null) {
        ids.push(String(candidate));
      }
    }

    // Ensure uniqueness
    return Array.from(new Set(ids));
  }, [blockData]);
  // --- REPLACE END ---

  // Normalize backend response:
  // - supports both [] and { conversations: [] }
  // - enriches with partnerId / partnerEmail / partnerUsername + premium metadata,
  //   but keeps the original shape (returns ...item + extra fields).
  const normalizedConversations = React.useMemo(() => {
    if (!conversations) return [];

    let arr = conversations;

    // Future proofing: if backend ever returns { conversations: [...] }
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
        // Partner id we are talking with – fallback order:
        partnerId: item.partnerId ?? item.userId ?? item._id,
        // Email if available from any known field:
        partnerEmail: item.partnerEmail ?? item.email ?? item.userEmail ?? null,
        // Name / display label:
        partnerUsername:
          item.partnerUsername ??
          item.username ??
          item.name ??
          (emailLike ? emailLike.split("@")[0] : ""),
        // Premium metadata:
        premium: item.premium ?? isPremium,
        isPremium,
        entitlements,
      };
    });
  }, [conversations]);

  // --- REPLACE START: filter out conversations with blocked peers (by partnerId/userId/etc.) ---
  const visibleConversations = React.useMemo(() => {
    if (!normalizedConversations || normalizedConversations.length === 0) {
      return [];
    }
    if (!blockedIds || blockedIds.length === 0) {
      return normalizedConversations;
    }

    return normalizedConversations.filter((item) => {
      const id =
        item.partnerId ||
        item.userId ||
        item.id ||
        item._id ||
        item.peerId ||
        null;

      if (!id) return true;
      return !blockedIds.includes(String(id));
    });
  }, [normalizedConversations, blockedIds]);
  // --- REPLACE END ---

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

  // --- REPLACE START: neutral empty-state card with CTA (no Bunny placeholder card) ---
  if (!visibleConversations || visibleConversations.length === 0) {
    return (
      <section
        className={styles.empty}
        aria-label={t("chat:overview.title", {
          defaultValue: "Conversations",
        })}
      >
        <h2 className="text-xl font-semibold mb-2 text-center">
          {t("chat:overview.emptyTitle", {
            defaultValue: "No conversations yet",
          })}
        </h2>
        <p className="text-gray-600 text-sm mb-4 text-center max-w-md mx-auto">
          {t("chat:overview.emptyBody", {
            defaultValue:
              "When you match and start messaging, your conversations will appear here.",
          })}
        </p>
        <div className="flex justify-center">
          <Link
            to="/discover"
            className="inline-flex items-center px-4 py-2 rounded-md bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          >
            {t("chat:overview.emptyCta", {
              defaultValue: "Discover users",
            })}
          </Link>
        </div>
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
      {visibleConversations.map((convo) => {
        const partnerId = convo.partnerId || convo.userId || convo.id || "";
        const isActive =
          !!activeUserId && String(partnerId) === String(activeUserId);

        return (
          <ConversationCard
            key={partnerId}
            convo={convo}
            isActive={isActive}
          />
        );
      })}
    </section>
  );
}

// The replacement regions are marked between
// --- REPLACE START and // --- REPLACE END
// so you can verify exactly what changed.

