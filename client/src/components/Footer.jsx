import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

const Footer = () => {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = () => {
      setLang(i18n.language); // re-render kun kieli vaihtuu
    };
    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, [i18n]);

  return (
    <footer
      className="text-white py-12 text-sm w-screen"
      style={{
        backgroundImage: 'url("/Footer.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full px-8 max-w-none overflow-x-auto">
        <div
          className="text-left min-w-[800px]"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '2rem',
          }}
        >
          {/* Company */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">{t('company')}</h4>
            <ul className="space-y-1">
              <li>
                <Link to="/about" className="hover:underline">
                  {t('about')}
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:underline">
                  {t('careers')}
                </Link>
              </li>
              <li>
                <Link to="/press" className="hover:underline">
                  {t('press')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">{t('conditions')}</h4>
            <ul className="space-y-1">
              <li>
                <Link to="/privacy" className="hover:underline">
                  {t('Privacy')}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:underline">
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:underline">
                  {t('cookies')}
                </Link>
              </li>
              <li>
                <Link to="/community" className="hover:underline">
                  {t('community')}
                </Link>
              </li>
              <li>
                <Link to="/health-policy" className="hover:underline">
                  {t('health')}
                </Link>
              </li>
              <li>
                <Link to="/colorado-policy" className="hover:underline">
                  {t('coInfo')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">{t('contact')}</h4>
            <ul className="space-y-1">
              <li>
                <Link to="/support" className="hover:underline">
                  {t('support')}
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:underline">
                  {t('security')}
                </Link>
              </li>
              <li>
                <Link to="/safety-tips" className="hover:underline">
                  {t('safety')}
                </Link>
              </li>
              <li>
                <Link to="/impressum" className="hover:underline">
                  {t('impressum')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Follow */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">{t('follow')}</h4>
            <ul className="space-y-1">
              <li>
                <a href="#" className="hover:underline">
                  {t('blog')}
                </a>
              </li>
              <li>
                <a href="https://twitter.com" className="hover:underline">
                  Twitter
                </a>
              </li>
              <li>
                <a href="https://facebook.com" className="hover:underline">
                  Facebook
                </a>
              </li>
              <li>
                <a href="https://instagram.com" className="hover:underline">
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Special */}
          <div>
            <h4 className="font-bold uppercase text-xs mb-2">{t('special')}</h4>
            <ul className="space-y-1">
              <li>
                <Link to="/map" className="hover:underline">
                  {t('Map')}
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:underline">
                  {t('Admin')}
                </Link>
              </li>
              <li>
                <Link to="/download" className="hover:underline">
                  {t('download')}
                </Link>
              </li>
              +{' '}
              <li>
                <Link to="/settings" className="hover:underline">
                  {t('Settings')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom text */}
        <div className="text-center text-gray-200 text-xs mt-10 leading-tight">
          <p>
            © {new Date().getFullYear()} DateSite – {t('rights')}
          </p>
          <p className="mt-1">{t('tagline')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
