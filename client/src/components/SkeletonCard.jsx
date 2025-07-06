import React from 'react';

/**
 * SkeletonCard
 * Yleiskäyttöinen korttipohjainen skeleton-paikkaaja.
 * Props:
 *  - width (string): Tailwind-luokkia leveydelle (esim. 'w-full', 'w-64')
 *  - height (string): Tailwind-luokkia korkeudelle (esim. 'h-40', 'h-24')
 *  - lines (number): montako tekstiriviä näytetään (default 3)
 */
const SkeletonCard = ({ width = 'w-full', height = 'h-40', lines = 3 }) => {
  const lineElements = Array.from({ length: lines }).map((_, i) => (
    <div
      key={i}
      className="bg-gray-200 dark:bg-gray-700 rounded h-4 mb-2 last:mb-0"
      style={{
        width: `${(100 - i * 10) / 100 * 100}%`
      }}
    />
  ));

  return (
    <div className={`animate-pulse ${width} ${height} bg-gray-100 dark:bg-gray-800 rounded-lg p-4`}>      
      <div className="flex items-center space-x-4 mb-4">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-12 w-12" />
        <div className="flex-1">
          <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 mb-2 w-3/4" />
          <div className="bg-gray-200 dark:bg-gray-700 rounded h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-1">
        {lineElements}
      </div>
    </div>
  );
};

export default SkeletonCard;
