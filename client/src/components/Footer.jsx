// PATH: client/src/components/Footer.jsx

// --- REPLACE START: Footer hardens against accidental object children by String()-coercion for all t() outputs ---
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Footer — layout
 * Headings (Company, Conditions, Contact, Special) in one row.
 * Links stacked vertically under each heading.
 * Admin link is visible only to users with role === "admin".
 *
 * NOTE:
 * - All t('...') calls target leaf keys and provide defaultValue.
 * - We additionally coerce outputs with String(...) to avoid crashing if a translation key
 *   unexpectedly resolves to a non-string (e.g., object) due to a misconfigured resource.
 *
 * PERFORMANCE NOTE (IMPORTANT)
 * ---------------------------
 * Lighthouse mobile reported Footer.png being fetched (~1.2MB). Because the footer uses an inline
 * backgroundImage, the browser will download it immediately. To keep the desktop look BUT prevent
 * the fetch on mobile, we only set backgroundImage on desktop-sized viewports.
 *
 * NEW (FORMAT OPTIMIZATION)
 * -------------------------
 * - Desktop background supports CSS image-set() (AVIF/WebP/PNG) so modern browsers can download
 *   a smaller format WITHOUT changing layout or visuals.
 * - IMPORTANT: If /Footer.avif or /Footer.webp are missing, we automatically fall back to the
 *   existing /Footer.png so the original background look never disappears.
 * - Optional lightweight preload is available (disabled by default) to preload the best format.
 *
 * CLS NOTE
 * --------
 * Footer is usually below the fold; CLS impact is typically low. We keep markup stable and avoid
 * any late-mount images on mobile by keeping the background desktop-only.
 */
const Footer = () => {
  const { t } = useTranslation();
  const { user, bootstrapped } = useAuth();

  /**
   * Desktop-only background image toggle
   * -----------------------------------
   * We avoid setting backgroundImage on mobile to prevent fetching Footer assets.
   * This is reactive, so resizing from mobile -> desktop will add the background.
   */
  const [useDesktopBackground, setUseDesktopBackground] = useState(false);

  useEffect(() => {
    // Guard for non-browser/test environments (should still be fine in Vite, but safe)
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    // Tailwind md breakpoint is 768px by default; align with that for consistency.
    const mq = window.matchMedia("(min-width: 768px)");

    const apply = (e) => {
      // Prefer event.matches, fall back to mq.matches
      const next = Boolean(e?.matches ?? mq.matches);
      setUseDesktopBackground(next);
    };

    // Set immediately on mount so first paint matches the current viewport
    apply();

    // Prefer the modern event API
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    // Fallback: use onchange if present (avoids deprecated addListener/removeListener)
    if ("onchange" in mq) {
      mq.onchange = apply;
      return () => {
        mq.onchange = null;
      };
    }

    return undefined;
  }, []);

  // --- REPLACE START: image-set(AVIF/WebP/PNG) with guaranteed PNG fallback (preserves the old look) ---
  // Optional: set to true if you want to preload the best format (AVIF/WebP/PNG) on desktop.
  // NOTE: Disabled by default to keep initial work minimal and avoid extra requests.
  const ENABLE_FOOTER_BG_PRELOAD = false;

  // If you have not created Footer.avif/Footer.webp yet, this code still keeps the original Footer.png
  // background, because we verify the chosen asset loads and fall back to PNG if it does not.
  const FOOTER_BG_IMAGESET = `image-set(
    url("/Footer.avif") type("image/avif"),
    url("/Footer.webp") type("image/webp"),
    url("/Footer.png") type("image/png")
  )`;

  const FOOTER_BG_WEBKIT_IMAGESET = `-webkit-image-set(
    url("/Footer.avif") type("image/avif"),
    url("/Footer.webp") type("image/webp"),
    url("/Footer.png") type("image/png")
  )`;

  // Tracks what we should paint on desktop:
  // - "imageset" => use image-set (AVIF/WebP/PNG candidates)
  // - "png"      => use url("/Footer.png") only (guarantees the old background)
  const [footerBgMode, setFooterBgMode] = useState("png");

  /**
   * Pick the best single asset URL for preloading/verification.
   * - Prefer AVIF, then WebP, then PNG.
   * - Detection uses CSS.supports where available; fallback is PNG.
   */
  const pickBestFooterAsset = useCallback(() => {
    try {
      if (typeof window === "undefined") return { href: "/Footer.png", type: "image/png", mode: "png" };

      const supports = typeof window.CSS !== "undefined" && typeof window.CSS.supports === "function";

      if (supports) {
        const avifOk = window.CSS.supports(
          "background-image",
          'image-set(url("x.avif") type("image/avif"))'
        );
        if (avifOk) return { href: "/Footer.avif", type: "image/avif", mode: "imageset" };

        const webpOk = window.CSS.supports(
          "background-image",
          'image-set(url("x.webp") type("image/webp"))'
        );
        if (webpOk) return { href: "/Footer.webp", type: "image/webp", mode: "imageset" };
      }
    } catch {
      // If detection fails, fall back to PNG.
    }

    return { href: "/Footer.png", type: "image/png", mode: "png" };
  }, []);

  useEffect(() => {
    // On mobile: keep background off (prevents fetch).
    if (!useDesktopBackground) {
      setFooterBgMode("png");
      return undefined;
    }

    // Guard for non-browser/test environments
    if (typeof window === "undefined") {
      setFooterBgMode("png");
      return undefined;
    }

    let cancelled = false;

    const ensurePreloadLink = ({ href, type }) => {
      if (!ENABLE_FOOTER_BG_PRELOAD) return;
      if (typeof document === "undefined") return;

      const id = "footer-bg-preload";
      if (document.getElementById(id)) return;

      const link = document.createElement("link");
      link.id = id;
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      if (type) link.type = type;

      document.head.appendChild(link);
    };

    const loadOne = ({ href }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = href;

        const done = (ok) => resolve(Boolean(ok));

        const finalize = async () => {
          try {
            if (typeof img.decode === "function") await img.decode();
          } catch {
            // Ignore decode errors; onload was already successful.
          }
          done(true);
        };

        if (img.complete) {
          finalize();
        } else {
          img.onload = () => finalize();
          img.onerror = () => done(false);
        }
      });
    };

    const run = async () => {
      const chosen = pickBestFooterAsset();
      ensurePreloadLink(chosen);

      // 1) Try chosen (avif/webp/png)
      const okChosen = await loadOne(chosen);
      if (cancelled) return;

      if (okChosen) {
        setFooterBgMode(chosen.mode || "png");
        return;
      }

      // 2) Fallback to PNG (guarantees old look)
      const okPng = await loadOne({ href: "/Footer.png" });
      if (cancelled) return;

      setFooterBgMode(okPng ? "png" : "png");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [useDesktopBackground, pickBestFooterAsset]);
  // --- REPLACE END ---

  // --- REPLACE START: final background values (desktop-only) ---
  // Desktop:
  // - If AVIF/WebP exists and loads => image-set
  // - Else => PNG (original)
  // Mobile:
  // - none (prevents fetch)
  const footerBgImage = useDesktopBackground
    ? footerBgMode === "imageset"
      ? FOOTER_BG_IMAGESET
      : 'url("/Footer.png")'
    : "none";

  const footerBgWebkitImage = useDesktopBackground
    ? footerBgMode === "imageset"
      ? FOOTER_BG_WEBKIT_IMAGESET
      : 'url("/Footer.png")'
    : "none";
  // --- REPLACE END ---

  return (
    // --- REPLACE START: avoid nested <footer> landmarks (MainLayout already wraps Footer in <footer>) ---
    <div
      className="text-white py-12 text-sm w-full"
      style={{
        // Desktop-only: prevents Footer assets from being fetched on mobile.
        // Guaranteed fallback to the original Footer.png so visuals do not change.
        backgroundImage: footerBgImage,
        WebkitBackgroundImage: footerBgWebkitImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* --- REPLACE END --- */}
      <div className="w-full px-8 max-w-none overflow-x-auto">
        <div
          className="text-left min-w-[800px] grid gap-8"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          {/* Company */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {String(t("common:nav.company", { defaultValue: "Company" }))}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/about" className="hover:underline">
                  {String(t("common:nav.about", { defaultValue: "About" }))}
                </Link>
              </li>
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {String(t("common:nav.conditions", { defaultValue: "Conditions" }))}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/privacy" className="hover:underline">
                  {String(t("common:nav.privacy", { defaultValue: "Privacy" }))}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:underline">
                  {String(t("common:nav.terms", { defaultValue: "Terms" }))}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:underline">
                  {String(t("common:nav.cookies", { defaultValue: "Cookies" }))}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {String(t("common:nav.contact", { defaultValue: "Contact" }))}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/support" className="hover:underline">
                  {String(t("common:nav.support", { defaultValue: "Support" }))}
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:underline">
                  {String(
                    t("common:nav.security", {
                      defaultValue: "Security (Safety Tips)",
                    })
                  )}
                </Link>
              </li>
            </ul>
          </div>

          {/* Special */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {String(t("common:nav.special", { defaultValue: "Special" }))}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/map" className="hover:underline">
                  {String(t("common:nav.map", { defaultValue: "Map" }))}
                </Link>
              </li>

              {/* Admin link only after auth bootstrap and for admin role */}
              {bootstrapped && user?.role === "admin" && (
                <li>
                  <Link to="/admin" className="hover:underline">
                    {String(t("common:nav.admin", { defaultValue: "Admin" }))}
                  </Link>
                </li>
              )}

              <li>
                <Link to="/settings" className="hover:underline">
                  {String(t("common:nav.settings", { defaultValue: "Settings" }))}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom text */}
        <div className="text-center text-gray-200 text-xs mt-10 leading-tight">
          <p>
            © {new Date().getFullYear()}{" "}
            {String(t("site.brand", { defaultValue: "Loventia" }))} —{" "}
            {String(t("common:nav.rights", { defaultValue: "All rights reserved." }))}
          </p>
          <p className="mt-1">
            {String(
              t("common:nav.tagline", {
                defaultValue: "Match better. Love smarter. 💘",
              })
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Footer;
// --- REPLACE END ---

