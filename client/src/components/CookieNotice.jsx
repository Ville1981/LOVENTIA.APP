import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CookieNotice = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowBanner(false);
  };

  return (
    showBanner && (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-4 text-sm flex justify-between items-center z-50">
        <p>
          Sivustomme käyttää evästeitä parhaan käyttökokemuksen takaamiseksi.{' '}
          <Link to="/privacy" className="underline hover:text-blue-300">
            Lisätietoja
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="ml-4 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
        >
          Hyväksy
        </button>
      </div>
    )
  );
};

export default CookieNotice;
