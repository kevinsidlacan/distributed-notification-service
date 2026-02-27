import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

const API_BASE = 'http://localhost:3001';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }

      // Auto-login after successful registration (backend returns a token directly)
      login(data.token);
      navigate('/', { replace: true });
    } catch {
      setError('Unable to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <div className={styles.logoTitle}>NotifQ</div>
          <div className={styles.logoSubtitle}>Create an admin account</div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-email">Email</label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              placeholder="admin@notifq.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            id="register-submit"
            className={styles.submitButton}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>

          <div className={styles.credentials}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
