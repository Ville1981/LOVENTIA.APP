// --- REPLACE START: Privacy Policy page updated to English ---
import React from "react";

/**
 * PrivacyPolicy
 * This page explains what personal data is collected,
 * how it is used, stored, and user rights.
 */
const PrivacyPolicy = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="mb-4">
        This site collects and processes personal data in order to provide a
        safe and functional dating service. The data we collect may include:
        name, email, age, location, interests, and messages.
      </p>

      <h2 className="text-xl font-semibold mt-4 mb-2">Use of Information</h2>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Displaying and managing user profiles</li>
        <li>Creating matches and enabling conversations</li>
        <li>Handling premium memberships (via Stripe)</li>
        <li>Ensuring site maintenance and security</li>
      </ul>

      <h2 className="text-xl font-semibold mt-4 mb-2">Sharing of Information</h2>
      <p className="mb-4">
        We do not share your personal information with third parties without
        your consent, except for our payment provider (Stripe). We use cookies
        to improve functionality and enhance your experience on the site.
      </p>

      <h2 className="text-xl font-semibold mt-4 mb-2">Account Deletion</h2>
      <p className="mb-4">
        You may delete your account at any time from the Settings page. When you
        do so, all your personal data will be permanently removed from our
        service.
      </p>

      

      <p className="text-sm text-gray-500">
        Last updated: August 24, 2025
      </p>
    </div>
  );
};

export default PrivacyPolicy;
// --- REPLACE END ---
