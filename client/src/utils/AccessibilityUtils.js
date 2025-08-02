// File: src/utils/AccessibilityUtils.js

/**
 * Utility functions for ARIA labels and keyboard interaction support.
 */
const AccessibilityUtils = {
  /**
   * Adds an ARIA-label attribute to the given element.
   * @param {HTMLElement} el - The target element
   * @param {string} label - The aria-label text
   */
  setAriaLabel(el, label) {
    // --- REPLACE START: set aria-label attribute
    el.setAttribute('aria-label', label);
    // --- REPLACE END: set aria-label attribute
  },

  /**
   * Attaches a keydown listener that triggers callback on Enter key.
   * @param {HTMLElement} el - The target element
   * @param {Function} callback - The function to call on Enter
   */
  onEnter(el, callback) {
    // --- REPLACE START: add Enter key listener
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        callback(e);
      }
    });
    // --- REPLACE END: add Enter key listener
  },

  /**
   * Attaches a keydown listener that triggers callback on Space key.
   * @param {HTMLElement} el - The target element
   * @param {Function} callback - The function to call on Space
   */
  onSpace(el, callback) {
    // --- REPLACE START: add Space key listener
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        callback(e);
      }
    });
    // --- REPLACE END: add Space key listener
  },
};

export default AccessibilityUtils;
