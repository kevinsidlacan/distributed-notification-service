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
    let isMounted = true;
    
    // Initial fetch - wrap in an async IIFE to avoid direct state updates inside the effect body
    (async () => {
      if (isMounted) await fetchCampaigns();
    })();
    
    const interval = setInterval(() => {
      if (isMounted) fetchCampaigns();
    }, 5000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchCampaigns]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredCampaigns = campaigns.filter((c) => {
    const isActive = c.status === 'pending' || c.status === 'processing';
    if (filter === 'active') return isActive;
    if (filter === 'completed') return !isActive;
    return true;
  });

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

      <div className={styles.filterBar}>
        <button 
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={`${styles.filterBtn} ${filter === 'active' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('active')}
        >
          Active
        </button>
        <button 
          className={`${styles.filterBtn} ${filter === 'completed' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      <div className={styles.table}>
        {filteredCampaigns.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📭</div>
            No campaigns found matching this filter.
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
              {filteredCampaigns.map((c) => (
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
