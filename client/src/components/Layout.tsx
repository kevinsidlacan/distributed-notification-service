import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⚡</div>
          <div className={styles.logoTitle}>NotifQ</div>
          <div className={styles.logoSubtitle}>Notification Service</div>
        </div>
        <nav className={styles.nav}>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
            end
          >
            <span className={styles.navIcon}>📋</span>
            Campaigns
          </NavLink>
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            id="logout-button"
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            <span className={styles.navIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
