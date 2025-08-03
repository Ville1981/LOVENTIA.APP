// client/src/components/ModerationPanel.jsx

import React, { useEffect, useState } from 'react';
import api from '../utils/axiosInstance';
import styles from './ModerationPanel.module.css'; // assume you use CSS modules

/**
 * Admin Moderation Panel
 * Fetches pending reports and allows approving or rejecting each.
 */
export default function ModerationPanel() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch pending reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/moderation/pending');
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError('Could not load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId, action) => {
    try {
      await api.post('/api/moderation/resolve', { reportId, action });
      // Remove handled report from UI
      setReports(prev => prev.filter(r => r._id !== reportId));
    } catch (err) {
      console.error(`Failed to ${action} report:`, err);
      alert(`Could not ${action} report.`);
    }
  };

  if (loading) return <div className={styles.loading}>Loading reports…</div>;
  if (error)   return <div className={styles.error}>{error}</div>;
  if (reports.length === 0) {
    return <div className={styles.empty}>No pending reports.</div>;
  }

  return (
    <div className={styles.panel}>
      <h2>Pending Reports</h2>
      <ul className={styles.list}>
        {reports.map(report => (
          <li key={report._id} className={styles.item}>
            <div className={styles.message}>
              {/* --- REPLACE START: show reported message text --- */}
              <strong>Message:</strong> {report.message.text}
              {/* --- REPLACE END --- */}
            </div>
            <div className={styles.info}>
              <span><strong>Reporter:</strong> {report.reporter.email}</span>
              <span><strong>Reason:</strong> {report.reason}</span>
              <span><strong>Reported at:</strong> {new Date(report.createdAt).toLocaleString()}</span>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.approve}
                onClick={() => handleResolve(report._id, 'approve')}
              >
                Approve
              </button>
              <button
                className={styles.reject}
                onClick={() => handleResolve(report._id, 'reject')}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
