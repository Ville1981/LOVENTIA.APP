// --- REPLACE START: footer with nav.* labels for navigation items ---
import PropTypes from "prop-types";
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Footer
 * - All navigation text is translated via i18n keys (nav.*)
 * - No hard-coded labels; every label uses t('nav.*') with defaultValue fallbacks
 * - Structure preserved; only internationalization adjustments
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
              {t("nav.company", { defaultValue: "Company" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/about" className="hover:underline">
                  {t("nav.about", { defaultValue: "About" })}
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:underline">
                  {t("nav.careers", { defaultValue: "Careers" })}
                </Link>
              </li>
              <li>
                <Link to="/press" className="hover:underline">
                  {t("nav.press", { defaultValue: "Press" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("nav.conditions", { defaultValue: "Conditions" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/privacy" className="hover:underline">
                  {t("nav.privacy", { defaultValue: "Privacy" })}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:underline">
                  {t("nav.terms", { defaultValue: "Terms" })}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:underline">
                  {t("nav.cookies", { defaultValue: "Cookies" })}
                </Link>
              </li>
              <li>
                <Link to="/community" className="hover:underline">
                  {t("nav.community", { defaultValue: "Community" })}
                </Link>
              </li>
              <li>
                <Link to="/health-policy" className="hover:underline">
                  {t("nav.health", { defaultValue: "Health Policy" })}
                </Link>
              </li>
              <li>
                <Link to="/colorado-policy" className="hover:underline">
                  {t("nav.coInfo", { defaultValue: "Colorado Info" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("nav.contact", { defaultValue: "Contact" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/support" className="hover:underline">
                  {t("nav.support", { defaultValue: "Support" })}
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:underline">
                  {t("nav.security", { defaultValue: "Security" })}
                </Link>
              </li>
              <li>
                <Link to="/safety-tips" className="hover:underline">
                  {t("nav.safety", { defaultValue: "Safety Tips" })}
                </Link>
              </li>
              <li>
                <Link to="/impressum" className="hover:underline">
                  {t("nav.impressum", { defaultValue: "Impressum" })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Follow */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("nav.follow", { defaultValue: "Follow" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/blog" className="hover:underline">
                  {t("nav.blog", { defaultValue: "Blog" })}
                </Link>
              </li>
              <li>
                <a
                  href="https://twitter.com"
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://facebook.com"
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Special */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">
              {t("nav.special", { defaultValue: "Special" })}
            </h4>
            <ul className="space-y-1">
              <li>
                <Link to="/map" className="hover:underline">
                  {t("nav.map", { defaultValue: "Map" })}
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:underline">
                  {t("nav.admin", { defaultValue: "Admin" })}
                </Link>
              </li>
              <li>
                <Link to="/download" className="hover:underline">
                  {t("nav.download", { defaultValue: "Download" })}
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:underline">
                  {t("nav.settings", { defaultValue: "Settings" })}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom text */}
        <div className="text-center text-gray-200 text-xs mt-10 leading-tight">
          <p>
            © {new Date().getFullYear()} {t("site.brand", { defaultValue: "Loventia" })} —{" "}
            {t("nav.rights", { defaultValue: "All rights reserved." })}
          </p>
          <p className="mt-1">
            {t("nav.tagline", { defaultValue: "Match better. Love smarter. 💘" })}
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

