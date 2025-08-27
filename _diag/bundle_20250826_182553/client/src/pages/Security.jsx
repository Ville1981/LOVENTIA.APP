import React from "react";

/**
 * Security
 * Safety tips and security guidelines for dating online.
 * Clear guidance: contact police in case of fraud.
 * Report feature is not implemented, so it is not mentioned here.
 */
const Security = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Security & Safety Tips</h1>
      <p className="mb-4">
        Your safety is our priority. Please follow these guidelines when using
        the service:
      </p>

      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Never share your financial information with strangers.</li>
        <li>Be cautious when meeting someone in person for the first time.</li>
        <li>Arrange meetings in public places and inform a friend.</li>
        <li>
          If you suspect a scam, stop communication immediately and{" "}
          <strong>contact your local police</strong>.
        </li>
        <li>
          Police may be able to trace the scammer’s internet address and help
          with financial fraud cases.
        </li>
      </ul>

      <p className="text-sm text-gray-500">
        Last updated: August 24, 2025
      </p>
    </div>
  );
};

export default Security;
