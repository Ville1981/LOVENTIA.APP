// --- REPLACE START: cleaned footer for 5174 build (remove Careers, Press, Safety Tips, Download; keep About; merge Security+Safety Tips) ---
import PropTypes from "prop-types";
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Footer
 * - All navigation text is translated via i18n keys (common:nav.*) with English fallbacks.
 * - Updated per requirements:
 *   • Company: keep About only (remove Careers, Press)
 *   • Conditions: keep all links as placeholders
 *   • Contact: merge Safety Tips into Security; keep Support & Impressum
 *   • Follow: keep Blog only (remove social links for now)
 *   • Special: remove Download; keep Map, Admin, Settings
 */
const Footer = () => {
  const { t } = useTranslation();

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
          style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
        >
          {/* Company */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("common:nav.company", { defaultValue: "Company" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/about" className="hover:underline">
                  {t("common:nav.about", { defaultValue: "About" })}
                </Link>
              </li>
              {/* Removed: Careers, Press */}
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("common:nav.conditions", { defaultValue: "Conditions" })}
            </h4>
            <ul className="space-y-1">
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
              <li>
                <Link to="/community" className="hover:underline">
                  {t("common:nav.community", { defaultValue: "Community" })}
                </Link>
              </li>
              <li>
                <Link to="/health-policy" className="hover:underline">
                  {t("common:nav.health", { defaultValue: "Health Policy" })}
                </Link>
              </li>
              <li>
                <Link to="/colorado-info" className="hover:underline">
                  {t("common:nav.coInfo", { defaultValue: "Colorado Info" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("common:nav.contact", { defaultValue: "Contact" })}
            </h4>
            <ul className="space-y-1">
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
              {/* Removed: separate Safety Tips link (merged into Security) */}
              <li>
                <Link to="/impressum" className="hover:underline">
                  {t("common:nav.impressum", { defaultValue: "Impressum" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Follow */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("common:nav.follow", { defaultValue: "Follow" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/blog" className="hover:underline">
                  {t("common:nav.blog", { defaultValue: "Blog" })}
                </Link>
              </li>
              {/* Removed: Twitter, Facebook, Instagram */}
            </ul>
          </div>

          {/* Special */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("common:nav.special", { defaultValue: "Special" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/map" className="hover:underline">
                  {t("common:nav.map", { defaultValue: "Map" })}
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:underline">
                  {t("common:nav.admin", { defaultValue: "Admin" })}
                </Link>
              </li>
              {/* Removed: Download */}
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
