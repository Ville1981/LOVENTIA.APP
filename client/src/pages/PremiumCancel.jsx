import React from 'react';
import { useTranslation } from 'react-i18next';

const PremiumCancel = () => {
  const { t } = useTranslation();

  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold text-red-500 mb-4">❌ {t('premium.cancelTitle')}</h1>
      <p>{t('premium.cancelMessage')}</p>
    </div>
  );
};

export default PremiumCancel;
