// --- REPLACE START: lightweight subscriptions page placeholder ---
import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Subscriptions
 * - Placeholder to manage / start Premium.
 * - Wire this later to your real billing provider (e.g., Stripe portal / Checkout).
 */
const Subscriptions = () => {
  const navigate = useNavigate();

  const goBack = () => navigate(-1);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Subscription Settings</h1>

      <p className="mb-6">
        Here you can start, manage or cancel your Premium membership. This is a
        placeholder page — connect it to your billing provider (e.g., Stripe)
        when ready.
      </p>

      <div className="space-y-4">
        <section className="p-4 rounded border bg-white/70">
          <h2 className="text-xl font-semibold mb-2">Current Plan</h2>
          <p className="text-sm text-gray-700">
            You are currently on the <strong>Free</strong> plan.
          </p>
        </section>

        <section className="p-4 rounded border bg-white/70">
          <h2 className="text-xl font-semibold mb-2">Go Premium</h2>
          <ul className="list-disc list-inside text-sm mb-4 space-y-1">
            <li>See who liked you</li>
            <li>3 Super Likes per week</li>
            <li>Unlimited likes & rewinds</li>
            <li>Dealbreakers feature</li>
            <li>No ads</li>
          </ul>

          {/* TODO: Replace the onClick with your real Checkout/Portal redirect */}
          <button
            onClick={() => alert("TODO: Redirect to Checkout / Stripe")}
            className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
          >
            Start Premium
          </button>
        </section>

        <section className="p-4 rounded border bg-white/70">
          <h2 className="text-xl font-semibold mb-2">Manage Existing Subscription</h2>
          {/* TODO: Replace href with your Stripe Billing Portal URL */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("TODO: Redirect to Billing Portal (Stripe)");
            }}
            className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Open Billing Portal
          </a>
        </section>
      </div>

      <button onClick={goBack} className="mt-6 text-sm underline">
        ← Back
      </button>
    </div>
  );
};

export default Subscriptions;
// --- REPLACE END ---
