import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  sent: number;
  failed: number;
  pending: number;
  total: number;
}

export default function ProgressBar({ sent, failed, pending, total }: ProgressBarProps) {
  if (total === 0) return null;

  const sentPct = (sent / total) * 100;
  const failedPct = (failed / total) * 100;
  const pendingPct = (pending / total) * 100;

  return (
    <div>
      <div className={styles.track}>
        <div className={`${styles.segment} ${styles.sent}`} style={{ width: `${sentPct}%` }} />
        <div className={`${styles.segment} ${styles.failed}`} style={{ width: `${failedPct}%` }} />
        <div className={`${styles.segment} ${styles.pending}`} style={{ width: `${pendingPct}%` }} />
      </div>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--status-success)' }} />
          Sent {sent.toLocaleString()}
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--status-error)' }} />
          Failed {failed.toLocaleString()}
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'var(--border-medium)' }} />
          Pending {pending.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
