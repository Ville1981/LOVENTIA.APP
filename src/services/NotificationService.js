// File: src/services/NotificationService.js

/**
 * NotificationService manages browser notifications and toast messages.
 */
class NotificationService {
  constructor() {
    // --- REPLACE START: Initialize toast container in DOM
    this.toastsContainer = null;
    this._initToastContainer();
    // --- REPLACE END: Initialization
  }

  /**
   * Initializes the toast container element and appends to body
   * @private
   */
  _initToastContainer() {
    this.toastsContainer = document.createElement("div");
    this.toastsContainer.setAttribute("aria-live", "polite");
    this.toastsContainer.className = "fixed bottom-4 right-4 space-y-2 z-50";
    document.body.appendChild(this.toastsContainer);
  }

  /**
   * Requests permission and shows a browser notification
   * @param {{ title: string, options?: NotificationOptions }} config
   */
  async showBrowserNotification({ title, options = {} }) {
    // --- REPLACE START: Browser notification flow
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, options);
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(title, options);
      }
    }
    // --- REPLACE END: Browser notification
  }

  /**
   * Displays a toast message in the bottom-right corner
   * @param {{ message: string, durationMs?: number }} config
   */
  showToast({ message, durationMs = 3000 }) {
    // --- REPLACE START: Toast display logic
    const toast = document.createElement("div");
    toast.className =
      "bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out";
    toast.textContent = message;
    this.toastsContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0");
      toast.addEventListener("transitionend", () => toast.remove());
    }, durationMs);
    // --- REPLACE END: Toast display logic
  }
}

// Singleton instance
const notificationService = new NotificationService();
export default notificationService;
