// PATH: client/src/pages/Cookies.jsx

// --- REPLACE START: keep filename/import consistent, add SEO <Helmet>, and a safe "open settings" hook ---
import React, { useCallback } from "react";
import { Helmet } from "react-helmet";

/**
 * Cookies Policy Page
 * - Explains how cookies are used on Loventia.
 * - Safe to keep as a placeholder until the full legal version is provided.
 * - Includes a button to open the site's consent settings (if available).
 */
function Cookies() {
  // Gracefully try to open the consent manager (implemented by your ConsentBanner or similar)
  const openConsentSettings = useCallback(() => {
    try {
      // Option A: if you implemented a global handler
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("consent:open"));
      }
      // Option B (fallback): expose a global function from your banner if you prefer
      if (typeof window !== "undefined" && typeof window.__openConsentManager === "function") {
        window.__openConsentManager();
      }
    } catch {
      // no-op; page remains functional even if no consent manager is wired
    }
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Basic SEO head tags for this route */}
      <Helmet>
        <title>Cookie Policy • Loventia</title>
        <meta
          name="description"
          content="Learn how Loventia uses cookies and similar technologies, and how you can manage your cookie preferences."
        />
        <meta property="og:title" content="Cookie Policy • Loventia" />
        <meta
          property="og:description"
          content="Learn how Loventia uses cookies and similar technologies, and how you can manage your cookie preferences."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="/cookies" />
      </Helmet>

      <h1 className="text-2xl font-bold mb-6">Cookie Policy</h1>

      <p className="mb-4">
        This Cookie Policy explains how Loventia uses cookies and similar technologies to enhance your
        experience on our platform.
      </p>

      <div className="space-y-4">
        <section>
          <h2 className="text-lg font-semibold">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device to help websites recognize you and
            remember your preferences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. How We Use Cookies</h2>
          <p>
            We use cookies to keep you logged in, remember your settings, improve site performance,
            measure usage, and analyze traffic.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Managing Cookies</h2>
          <p>
            You can control or delete cookies in your browser settings. Please note that disabling
            cookies may limit some functionality on Loventia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Your Preferences</h2>
          <p className="mb-3">
            You can review or update your cookie preferences at any time using the button below.
          </p>
          <button
            type="button"
            onClick={openConsentSettings}
            className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition"
            aria-label="Open cookie settings"
          >
            Open cookie settings
          </button>
        </section>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        This is a simplified placeholder cookie policy. The full legal document will be provided later.
      </p>
    </div>
  );
}

export default Cookies;
// --- REPLACE END ---
