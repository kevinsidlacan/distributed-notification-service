import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: string;
}

const LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  completed_with_failures: 'Partial Failure',
  failed: 'Failed',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = LABELS[status] || status;
  const className = styles[status] || styles.pending;

  return (
    <span className={`${styles.badge} ${className}`}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
