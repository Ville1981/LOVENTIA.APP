// --- REPLACE START: Footer shows Admin link only to admin users (client build) ---
import PropTypes from "prop-types";
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Footer — layout
 * Headings (Company, Conditions, Contact, Special) in one row.
 * Links stacked vertically under each heading.
 * Admin link is visible only to users with role === "admin".
 */
const Footer = () => {
  const { t } = useTranslation();
  const { user, bootstrapped } = useAuth();

  return (
    <footer
      className="text-white py-12 text-sm w-screen"
      style={{
        backgroundImage: 'url("/Footer.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full px-8 max-w-none overflow-x-auto">
        <div
          className="text-left min-w-[800px] grid gap-8"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          {/* Company */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {t("common:nav.company", { defaultValue: "Company" })}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/about" className="hover:underline">
                  {t("common:nav.about", { defaultValue: "About" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {t("common:nav.conditions", { defaultValue: "Conditions" })}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/privacy" className="hover:underline">
                  {t("common:nav.privacy", { defaultValue: "Privacy" })}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:underline">
                  {t("common:nav.terms", { defaultValue: "Terms" })}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:underline">
                  {t("common:nav.cookies", { defaultValue: "Cookies" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {t("common:nav.contact", { defaultValue: "Contact" })}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/support" className="hover:underline">
                  {t("common:nav.support", { defaultValue: "Support" })}
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:underline">
                  {t("common:nav.security", {
                    defaultValue: "Security (Safety Tips)",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Special */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2 tracking-wide">
              {t("common:nav.special", { defaultValue: "Special" })}
            </h4>
            <ul className="space-y-1 list-disc pl-4">
              <li>
                <Link to="/map" className="hover:underline">
                  {t("common:nav.map", { defaultValue: "Map" })}
                </Link>
              </li>

              {/* Admin link only after auth bootstrap and for admin role */}
              {bootstrapped && user?.role === "admin" && (
                <li>
                  <Link to="/admin" className="hover:underline">
                    {t("common:nav.admin", { defaultValue: "Admin" })}
                  </Link>
                </li>
              )}

              <li>
                <Link to="/settings" className="hover:underline">
                  {t("common:nav.settings", { defaultValue: "Settings" })}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom text */}
        <div className="text-center text-gray-200 text-xs mt-10 leading-tight">
          <p>
            © {new Date().getFullYear()}{" "}
            {t("site.brand", { defaultValue: "Loventia" })} —{" "}
            {t("common:nav.rights", { defaultValue: "All rights reserved." })}
          </p>
          <p className="mt-1">
            {t("common:nav.tagline", {
              defaultValue: "Match better. Love smarter. 💘",
            })}
          </p>
        </div>
      </div>
    </footer>
  );
};

Footer.propTypes = {
  // no props expected
};

export default Footer;
// --- REPLACE END ---
