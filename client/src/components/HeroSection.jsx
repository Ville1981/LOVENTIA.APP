import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './HeroSection.css';

const images = ['/hero.jpg', '/hero1.jpg', '/hero2.jpg', '/hero3.jpg', '/hero4.jpg'];

function HeroSection() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const { t, i18n } = useTranslation();

  // 🔹 Kielikohtainen valinta teksteille
  const latinLangs = ['es-ES', 'es-MX', 'es-AR', 'es-CO'];
  const modernLangs = ['it', 'pl', 'sw'];

  // 🔄 Uusi logiikka joka kattaa sw + ur + muut
  const useModernText =
    modernLangs.includes(i18n.language) ||
    (!latinLangs.includes(i18n.language) && i18n.language !== 'en');

  const textKeys = useModernText
    ? ['etusivu.heroTekstit.0', 'etusivu.heroTekstit.1', 'etusivu.heroTekstit.2']
    : ['hero.0', 'hero.1', 'hero.2'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      setCurrentTextIndex((prev) => (prev === textKeys.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [textKeys]);

  return (
    <div className="hero-section-container">
      <div className="hero-section">
        {images.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Hero ${index}`}
            className={`hero-slide ${index === currentImageIndex ? 'active' : ''}`}
          />
        ))}

        <div className={`hero-overlay ${i18n.language === 'ar' ? 'rtl-align' : 'left'}`}>
          <h1 dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>{t(textKeys[currentTextIndex])}</h1>
        </div>
      </div>
    </div>
  );
}

export default HeroSection;
