// File: client/src/utils/adsData.js

// --- REPLACE START: avoid mobile eager-fetch of hero1..3 by keeping metadata but removing direct image URLs (HeroSection owns hero assets) ---
/**
 * adsData.js
 *
 * IMPORTANT (Performance / Lighthouse)
 * -----------------------------------
 * Lighthouse mobile runs showed /hero1.jpg .. /hero4.jpg being fetched immediately.
 * We already fixed HeroSection to NOT render the slideshow images on mobile.
 *
 * However, adsData previously referenced /hero1.jpg.. as "heroAds.image". If any component
 * accidentally renders these images (or preloads them), the browser will fetch them again.
 *
 * To make this robust:
 * - Keep the heroAds array (title/text) for any UI that uses the copy.
 * - Remove direct image URLs for heroAds so nothing can accidentally <img src="/heroX.jpg">.
 * - HeroSection is the single owner of hero background assets now.
 *
 * NOTE:
 * - We intentionally keep the rest (headerAds/leftAds/rightAds) unchanged.
 * - Keep comments in English to match project convention.
 */

// 🔹 Homepage hero texts (HeroSection owns the hero images)
export const heroAds = [
  {
    image: null,
    title: "Love Awaits",
    text: "Start your journey with a meaningful match.",
  },
  {
    image: null,
    title: "Welcome to DateSite!",
    text: "Find meaningful connections easily and safely.",
  },
  {
    image: null,
    title: "Real People. Real Stories.",
    text: "Your story begins here.",
  },
];

// 🔹 Discover & Profile header ads
export const headerAds = [
  { image: "/ads/header1.png" },
  { image: "/ads/header2.png" },
  { image: "/ads/header3.png" },
];

// 🔹 Side ads
export const leftAds = [
  {
    src: "/ads/ad-left1.png",
    link: "https://example.com/left1",
    alt: "Left Ad 1",
  },
  {
    src: "/ads/ad-left2.png",
    link: "https://example.com/left2",
    alt: "Left Ad 2",
  },
  {
    src: "/ads/ad-left3.png",
    link: "https://example.com/left3",
    alt: "Left Ad 3",
  },
];

export const rightAds = [
  {
    src: "/ads/ad-right1.png",
    link: "https://example.com/right1",
    alt: "Right Ad 1",
  },
  {
    src: "/ads/ad-right2.png",
    link: "https://example.com/right2",
    alt: "Right Ad 2",
  },
  {
    src: "/ads/ad-right3.png",
    link: "https://example.com/right3",
    alt: "Right Ad 3",
  },
];
// --- REPLACE END ---

