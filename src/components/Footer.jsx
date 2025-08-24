// --- REPLACE START: fixed JSX typo + cleaned links (no Careers/Press/Safety Tips/Download) ---
import PropTypes from "prop-types";
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Footer
 * - Navigation labels from i18n keys with English fallbacks.
 * - Removed: Careers, Press, Safety Tips (merged into Security), Download, social links.
 * - NOTE: Fixed JSX typo in the Cookies link (to="/cookies").
 */
const Footer = () => {
  const { t } = useTranslation();

  // Lightweight verification (safe to keep; remove later if desired)
  console.log("FOOTER VERIFY >> mounted v2 (cleaned links)");

  return (
    <footer
      data-footer-id="verify-v2"
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
              {/* Careers & Press removed */}
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
                {/* FIX: proper JSX attribute (was: to "/cookies") */}
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
              {/* Safety Tips merged into Security; removed separate link */}
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
              {/* Social links removed until real profiles exist */}
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
              {/* Download removed */}
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
