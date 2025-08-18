// --- REPLACE START: full AdminPanel with i18n + safe actions, minimal changes elsewhere ---
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { BACKEND_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";

import Button from "../components/ui/Button";
import ControlBar from "../components/ui/ControlBar";

export default function AdminPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = useMemo(() => {
    // If your project uses roles/flags on user, check them here.
    // Keep permissive fallback: if backend route is protected, this is only for UX.
    return !!authUser && (authUser.isAdmin || authUser.role === "admin");
  }, [authUser]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/users`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      // Support both { users: [...] } and raw array
      const list = Array.isArray(data) ? data : data.users || [];
      setUsers(list);
    } catch (e) {
      console.error("Admin fetch users failed:", e);
      setErr(t("discover.fetchError", { defaultValue: "Error fetching users." }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  const confirmDelete = useCallback(
    (u) => window.confirm(t("admin.confirmDelete", { defaultValue: "Are you sure you want to delete this user?" })),
    [t]
  );

  const mutateUser = useCallback(
    async (userId, action) => {
      setBusyId(userId);
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/users/${userId}/${action}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ts: Date.now() }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        setRefreshKey((k) => k + 1);
      } catch (e) {
        console.error(`Admin ${action} failed:`, e);
        setErr(t("messages.error", { defaultValue: "An error occurred" }));
      } finally {
        setBusyId(null);
      }
    },
    [t]
  );

  const handleDelete = useCallback(
    async (u) => {
      if (!confirmDelete(u)) return;
      setBusyId(u._id);
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/users/${u._id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        // Optimistic refresh
        setUsers((prev) => prev.filter((x) => x._id !== u._id));
      } catch (e) {
        console.error("Admin delete failed:", e);
        setErr(t("messages.error", { defaultValue: "An error occurred" }));
      } finally {
        setBusyId(null);
      }
    },
    [confirmDelete, t]
  );

  const handleHide = useCallback(
    async (u) => {
      await mutateUser(u._id, "hide");
    },
    [mutateUser]
  );

  const handleUnhide = useCallback(
    async (u) => {
      await mutateUser(u._id, "unhide");
    },
    [mutateUser]
  );

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4">
          <ControlBar>
            <Button onClick={() => navigate(-1)} variant="secondary">
              {t("buttons.back", { defaultValue: "Back" })}
            </Button>
          </ControlBar>
        </div>
        <div className="text-red-600">{t("error.forbidden", { defaultValue: "Forbidden" })}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <ControlBar>
        <Button onClick={() => navigate(-1)} variant="secondary">
          {t("buttons.back", { defaultValue: "Back" })}
        </Button>
      </ControlBar>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {t("admin.title", { defaultValue: "Admin Panel: User Management" })}
        </h1>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </header>

      {loading ? (
        <div className="text-gray-600">{t("messages.loading", { defaultValue: "Loading..." })}</div>
      ) : users.length === 0 ? (
        <div className="text-gray-600">{t("discover.noResults", { defaultValue: "No results" })}</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">{t("admin.name", { defaultValue: "Name" })}</th>
                <th className="px-3 py-2">{t("admin.location", { defaultValue: "Location" })}</th>
                <th className="px-3 py-2">{t("profile.username", { defaultValue: "Username" })}</th>
                <th className="px-3 py-2">{t("admin.hidden", { defaultValue: "Hidden?" })}</th>
                <th className="px-3 py-2">{t("admin.actions", { defaultValue: "Actions" })}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isHidden = !!u.hidden;
                const isBusy = busyId === u._id;
                const location = [u?.location?.city, u?.location?.country].filter(Boolean).join(", ");

                return (
                  <tr key={u._id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{u?.name || u?.displayName || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-600">{location || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-800">{u?.username || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                          isHidden ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {isHidden ? t("admin.yes", { defaultValue: "Yes" }) : t("admin.no", { defaultValue: "No" })}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {isHidden ? (
                          <Button
                            onClick={() => handleUnhide(u)}
                            disabled={isBusy}
                            size="sm"
                            variant="secondary"
                          >
                            {t("admin.unhide", { defaultValue: "Unhide" })}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleHide(u)}
                            disabled={isBusy}
                            size="sm"
                            variant="secondary"
                          >
                            {t("admin.hide", { defaultValue: "Hide" })}
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(u)}
                          disabled={isBusy}
                          size="sm"
                          variant="danger"
                        >
                          {t("admin.delete", { defaultValue: "Delete" })}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={() => setRefreshKey((k) => k + 1)} variant="secondary">
          {t("common.select", { defaultValue: "Select" }) /* simple placeholder: acts as "Refresh" if you prefer you can change key */}
        </Button>
        {/* If you prefer a dedicated refresh label, add to locales: "common.refresh": "Refresh" and use it here */}
      </div>
    </div>
  );
}
// --- REPLACE END

