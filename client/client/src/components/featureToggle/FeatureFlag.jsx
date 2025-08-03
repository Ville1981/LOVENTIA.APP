// src/components/featureToggle/FeatureFlag.jsx

import React from 'react';
import { useFeatureFlag } from './FeatureToggleProvider.jsx';

/**
 * Näyttää lapset vain, jos flag on käytössä
 */
export function FeatureFlag({ flag, children, fallback = null }) {
  const enabled = useFeatureFlag(flag);
  return enabled ? <>{children}</> : fallback;
}
