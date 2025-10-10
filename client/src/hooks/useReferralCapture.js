// --- REPLACE START: capture ?ref= from URL and persist to localStorage ---
import { useEffect } from "react";

export default function useReferralCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem("loventia:referral", ref);
      }
    } catch {
      /* no-op */
    }
  }, []);
}
// --- REPLACE END ---
