import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCampaignById, retryFailedMessages } from '../api/campaigns';
import type { CampaignDetail } from '../api/campaigns';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import styles from './CampaignDetailPage.module.css';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCampaignById(id);
      setCampaign(data);
    } catch (err) {
      console.error('Failed to fetch campaign:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();

    const interval = setInterval(() => {
      if (campaign?.status === 'processing' || campaign?.status === 'pending') {
        fetchCampaign();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchCampaign, campaign?.status]);

  const handleRetry = async () => {
    if (!id || retrying) return;
    setRetrying(true);
    setRetryResult(null);
    try {
      const result = await retryFailedMessages(id);
      setRetryResult(`${result.retriedCount} message(s) re-queued for retry`);
      fetchCampaign();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(false);
    }
  };

  if (!campaign) {
    return <div className={styles.loading}>Loading campaign...</div>;
  }

  const sent = campaign.progress['sent'] || 0;
  const failed = campaign.progress['failed'] || 0;
  const pending = (campaign.progress['pending'] || 0) + (campaign.progress['queued'] || 0);
  const processed = sent + failed;
  const completionPct = campaign.totalMessages > 0
    ? Math.round((processed / campaign.totalMessages) * 100)
    : 0;

  const isProcessing = campaign.status === 'processing' || campaign.status === 'pending';
  const hasFailed = failed > 0;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <Link to="/" className={styles.backLink}>← Back to campaigns</Link>

      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <div className={styles.meta}>Created {formatDate(campaign.createdAt)}</div>
        </div>
        {hasFailed && !isProcessing && (
          <button className={styles.btnRetry} onClick={handleRetry} disabled={retrying}>
            {retrying ? 'Retrying...' : `↻ Retry ${failed} Failed`}
          </button>
        )}
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.statTotal}`}>
          <div className={styles.statLabel}>Total Messages</div>
          <div className={styles.statValue}>{campaign.totalMessages.toLocaleString()}</div>
        </div>
        <div className={`${styles.statCard} ${styles.statSent}`}>
          <div className={styles.statLabel}>Sent</div>
          <div className={styles.statValue}>{sent.toLocaleString()}</div>
        </div>
        <div className={`${styles.statCard} ${styles.statFailed}`}>
          <div className={styles.statLabel}>Failed</div>
          <div className={styles.statValue}>{failed.toLocaleString()}</div>
        </div>
        <div className={`${styles.statCard} ${styles.statPending}`}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.statValue}>{pending.toLocaleString()}</div>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressTitle}>Delivery Progress</div>
        <div className={styles.percentage}>
          {completionPct}%
          <span className={styles.percentageLabel}> processed</span>
        </div>
        <ProgressBar sent={sent} failed={failed} pending={pending} total={campaign.totalMessages} />
        {isProcessing && (
          <div className={styles.pollingNote}>
            <span className={styles.pollingDot} />
            Updating every 2 seconds
          </div>
        )}
      </div>

      {retryResult && (
        <div className={styles.retryToast}>{retryResult}</div>
      )}
    </div>
  );
}
