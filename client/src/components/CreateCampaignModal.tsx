import { useState } from 'react';
import { createCampaign } from '../api/campaigns';
import styles from './CreateCampaignModal.module.css';

interface CreateCampaignModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const PRESETS = [50, 500, 5000, 10000];

export default function CreateCampaignModal({ onClose, onCreated }: CreateCampaignModalProps) {
  const [name, setName] = useState('');
  const [recipientCount, setRecipientCount] = useState(500);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    try {
      await createCampaign(name.trim(), recipientCount);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>New Campaign</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Campaign Name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Black Friday Promo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Recipient Count</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={100000}
              value={recipientCount}
              onChange={(e) => setRecipientCount(Number(e.target.value))}
            />
            <div className={styles.presets}>
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.preset} ${recipientCount === n ? styles.presetActive : ''}`}
                  onClick={() => setRecipientCount(n)}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.btnCreate} disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
