// File: client/src/components/DealbreakersPanel.jsx
// --- REPLACE START: minimal Dealbreakers panel (uses API stub) ---
import React, { useEffect, useState } from "react";
import { getDealbreakers, updateDealbreakers } from "../api/dealbreakers";
import FeatureGate from "./FeatureGate";

export default function DealbreakersPanel({ user }) {
  const [form, setForm] = useState({
    distanceKm: null,
    ageMin: null,
    ageMax: null,
    mustHavePhoto: false,
    nonSmokerOnly: false,
    noDrugs: false,
    petsOk: null,
  });
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const db = await getDealbreakers();
        if (db) setForm((prev) => ({ ...prev, ...db }));
      } catch (e) {
        console.error("[DealbreakersPanel] load error", e);
        setErr("Failed to load dealbreakers.");
      }
    })();
  }, []);

  const onChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const onSave = async () => {
    setSaving(true);
    setInfo("");
    setErr("");
    try {
      await updateDealbreakers(form);
      setInfo("Saved.");
    } catch (e) {
      console.error("[DealbreakersPanel] save error", e);
      setErr(e?.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="text-sm font-medium">{label}</label>
      <div>{children}</div>
    </div>
  );

  return (
    <FeatureGate
      user={user}
      feature="dealbreakers"
      fallback={
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Dealbreakers are a Premium feature.
        </div>
      }
    >
      <div className="rounded border p-4 space-y-3 bg-white">
        <h3 className="text-lg font-semibold">Dealbreakers</h3>

        {info && (
          <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-sm">
            {info}
          </div>
        )}
        {err && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 text-sm">
            {err}
          </div>
        )}

        <Field label="Max distance (km)">
          <input
            type="number"
            className="border rounded px-2 py-1 w-28"
            value={form.distanceKm ?? ""}
            onChange={(e) => onChange("distanceKm", e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 10"
            min={0}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Field label="Age min">
            <input
              type="number"
              className="border rounded px-2 py-1 w-24"
              value={form.ageMin ?? ""}
              onChange={(e) => onChange("ageMin", e.target.value ? Number(e.target.value) : null)}
              min={18}
              max={120}
            />
          </Field>
          <Field label="Age max">
            <input
              type="number"
              className="border rounded px-2 py-1 w-24"
              value={form.ageMax ?? ""}
              onChange={(e) => onChange("ageMax", e.target.value ? Number(e.target.value) : null)}
              min={18}
              max={120}
            />
          </Field>
        </div>

        <Field label="Must have photo">
          <input
            type="checkbox"
            checked={!!form.mustHavePhoto}
            onChange={(e) => onChange("mustHavePhoto", e.target.checked)}
          />
        </Field>

        <Field label="Non-smoker only">
          <input
            type="checkbox"
            checked={!!form.nonSmokerOnly}
            onChange={(e) => onChange("nonSmokerOnly", e.target.checked)}
          />
        </Field>

        <Field label="No drugs">
          <input
            type="checkbox"
            checked={!!form.noDrugs}
            onChange={(e) => onChange("noDrugs", e.target.checked)}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 py-1">
          <label className="text-sm font-medium">Pets OK</label>
          <select
            className="border rounded px-2 py-1"
            value={form.petsOk === null ? "null" : form.petsOk ? "true" : "false"}
            onChange={(e) =>
              onChange(
                "petsOk",
                e.target.value === "null" ? null : e.target.value === "true"
              )
            }
          >
            <option value="null">No preference</option>
            <option value="true">Must be OK with pets</option>
            <option value="false">No pets</option>
          </select>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={`px-4 py-2 rounded text-white ${
              saving ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </FeatureGate>
  );
}
// --- REPLACE END ---

