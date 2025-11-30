// PATH: client/src/pages/Security.jsx

// --- REPLACE START: Security & Safety Tips page ---
import React from "react";

/**
 * Security
 * Safety tips and security guidelines for dating online.
 * Clear guidance: contact police in case of fraud.
 * You do not need to track IP addresses yourself; authorities can request
 * technical information from service providers when needed.
 */
const Security = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-2">Security & Safety Tips</h1>

      <p className="mb-3 text-gray-700">
        Your safety is our priority. Please follow these guidelines when using
        the service:
      </p>

      <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-800">
        <li>Never send money to people you only know online.</li>
        <li>
          Never share your banking details, credit card information, passwords,
          or one-time codes with strangers.
        </li>
        <li>Be cautious when meeting someone in person for the first time.</li>
        <li>Arrange meetings in public places and inform a friend or family member.</li>
        <li>
          If you suspect a scam, stop communication immediately and{" "}
          <strong>contact your local police</strong>.
        </li>
        <li>
          Police may be able to trace the scammer&apos;s internet address and
          help with financial fraud cases. You do not need to investigate or
          track IP addresses yourself.
        </li>
        <li>
          If you have sent money or shared financial information, also contact
          your bank or card issuer as soon as possible.
        </li>
      </ul>

      <p className="text-sm text-gray-500">
        Last updated: November 26, 2025
      </p>
    </div>
  );
};

export default Security;
// --- REPLACE END ---
