// File: src/components/MessageFeedback.jsx
import React, { useEffect } from 'react';
import notificationService from '../services/NotificationService';

/**
 * Displays status feedback for message send/receive actions
 * @param {{ status: 'sending' | 'sent' | 'error' | 'received' }} props
 */
export default function MessageFeedback({ status }) {
  useEffect(() => {
    // --- REPLACE START: Toast notifications on status change
    if (status === 'sent') {
      notificationService.showToast({ message: 'Your message has been sent!' });
    } else if (status === 'error') {
      notificationService.showToast({ message: 'Message failed to send', durationMs: 5000 });
    }
    // --- REPLACE END: Toast notifications on status change
  }, [status]);

  let icon;
  switch (status) {
    case 'sending':
      icon = <span className="animate-spin" aria-label="Sending">⌛</span>;
      break;
    case 'sent':
      icon = <span aria-label="Sent">✓</span>;
      break;
    case 'error':
      icon = <span aria-label="Error">⚠️</span>;
      break;
    case 'received':
      icon = <span aria-label="Received">📩</span>;
      break;
    default:
      icon = null;
  }

  return (
    <div aria-live="polite" className="flex items-center space-x-1">
      {icon}
      {/* Screen-reader only status text */}
      <span className="sr-only">{status}</span>
    </div>
  );
}
