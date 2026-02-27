import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCampaigns } from '../api/campaigns';
import type { Campaign } from '../api/campaigns';
import StatusBadge from '../components/StatusBadge';
import CreateCampaignModal from '../components/CreateCampaignModal';
import styles from './CampaignListPage.module.css';

export default function CampaignListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Campaigns</h1>
          <div className={styles.subtitle}>
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              Auto-refreshing every 5s
            </span>
          </div>
        </div>
        <button className={styles.btnNew} onClick={() => setShowModal(true)}>
          <span>+</span> New Campaign
        </button>
      </div>

      <div className={styles.table}>
        {campaigns.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📭</div>
            No campaigns yet. Create your first one!
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Total</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className={styles.clickableRow}
                  onClick={() => navigate(`/campaigns/${c.id}`)}
                >
                  <td className={styles.nameCell}>{c.name}</td>
                  <td className={styles.numCell}>{c.totalMessages.toLocaleString()}</td>
                  <td className={styles.numCell}>{c.sentCount.toLocaleString()}</td>
                  <td className={styles.numCell}>{c.failedCount.toLocaleString()}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className={styles.dateCell}>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CreateCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={fetchCampaigns}
        />
      )}
    </div>
  );
}
