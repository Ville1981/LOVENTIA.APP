// File: client/src/hooks/useBlockedUserIds.js

import { useQuery } from "@tanstack/react-query";
import axios from "../utils/axiosInstance";

/**
 * useBlockedUserIds
 *
 * Fetches the current user's blocks from /api/block and normalizes them
 * into a flat string[] of userIds. Supports both:
 * - { ok, count, users: [...] }
 * - [ ... ] (array of blocks)
 */
export function useBlockedUserIds() {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["blockedUserIds"],
    queryFn: async () => {
      const res = await axios.get("/api/block");
      const result = res.data;

      let users = [];

      if (Array.isArray(result?.users)) {
        users = result.users;
      } else if (Array.isArray(result)) {
        users = result;
      }

      const ids = users
        .map((u) => {
          return (
            u.blockedUserId ??
            u.targetUserId ??
            u.targetId ??
            u.userId ??
            u.blockedId ??
            u.id ??
            u._id ??
            null
          );
        })
        .filter(Boolean)
        .map(String);

      // Deduplicate
      return Array.from(new Set(ids));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    blockedUserIds: data ?? [],
    isLoading,
    isError,
    error,
  };
}
