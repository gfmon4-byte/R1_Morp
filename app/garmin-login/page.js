'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

// SVG Icons
const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export default function GarminLoginPage() {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showReauth, setShowReauth] = useState(false);

  // MFA states
  const [sessionId, setSessionId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPromptMsg, setMfaPromptMsg] = useState('');
  const [mfaSecondsLeft, setMfaSecondsLeft] = useState(300);
  const otpInputRef = useRef(null);

  // Actions status (Testing / Syncing)
  const [activeAction, setActiveAction] = useState(null); // 'test' | 'sync_runs' | 'sync_profile' | null
  const actionLoading = Boolean(activeAction);
  const [actionStatusMsg, setActionStatusMsg] = useState(null);
  const actionTimeoutRef = useRef(null);

  const showActionStatus = (statusObj, durationMs = 60000) => {
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }
    setActionStatusMsg(statusObj);
    if (durationMs > 0) {
      actionTimeoutRef.current = setTimeout(() => {
        setActionStatusMsg(null);
      }, durationMs);
    }
  };

  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  // Fetch token status on load from Supabase
  const fetchTokenStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/garmin-login');
      const data = await res.json();
      setTokenInfo(data);
      if (data?.status === 'valid') {
        setErrorMsg(null);
      }
    } catch (err) {
      console.error('Failed to fetch token status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  // Auto-focus OTP input when MFA mode starts
  useEffect(() => {
    if (sessionId && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [sessionId]);

  // MFA 5-minute countdown timer
  useEffect(() => {
    if (!sessionId) return;
    setMfaSecondsLeft(300);
    const interval = setInterval(() => {
      setMfaSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMsg('MFA session expired. Please log in again.');
          setSessionId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Handle Primary Login Submission
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both Garmin email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/garmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: email.trim(), password }),
      });

      let data = {};
      try {
        const rawText = await res.text();
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (data.needs_mfa || data.needsMfa) {
        setSessionId(data.session_id || data.mfaState);
        setMfaPromptMsg(data.message || 'Garmin 2FA code sent to your email / authenticator app');
        setMfaCode('');
      } else if (data.success) {
        setSuccessMsg(data.message || 'Login successful! Fresh tokens saved to database.');
        setPassword('');
        setShowReauth(false);
        fetchTokenStatus();
      } else {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle 2FA / MFA Submission
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    if (!sessionId) {
      setErrorMsg('Session expired. Please start login again.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/garmin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mfa',
          session_id: sessionId,
          mfaState: sessionId,
          otp_code: mfaCode.trim(),
          code: mfaCode.trim(),
        }),
      });

      let data = {};
      try {
        const rawText = await res.text();
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (data.success) {
        setSuccessMsg(data.message || 'MFA verified and tokens stored in database!');
        setSessionId(null);
        setMfaCode('');
        setPassword('');
        setShowReauth(false);
        fetchTokenStatus();
      } else {
        if (data.session_expired) {
          setSessionId(null);
        }
        setErrorMsg(data.error || 'Invalid MFA code. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel MFA
  const handleCancelMfa = () => {
    setSessionId(null);
    setMfaCode('');
    setErrorMsg(null);
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    setActiveAction('test');
    setActionStatusMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/garmin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const data = await res.json();
      if (data.success) {
        showActionStatus({ ok: true, msg: '✅ ' + data.message }, 60000);
      } else {
        showActionStatus({ ok: false, msg: '❌ ' + (data.error || 'Connection failed') }, 20000);
      }
    } catch (err) {
      showActionStatus({ ok: false, msg: '❌ ' + err.message }, 20000);
    } finally {
      setActiveAction(null);
    }
  };

  // Trigger Activities Sync
  const handleSyncActivities = async () => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    setActiveAction('sync_runs');
    setActionStatusMsg(null);
    try {
      const res = await fetch('/api/garmin-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      if (data.success) {
        showActionStatus({
          ok: true,
          msg: `✅ Activities synced: ${data.inserted} new, ${data.skipped} existing`,
        }, 60000);
      } else {
        showActionStatus({ ok: false, msg: '❌ ' + (data.error || 'Sync failed') }, 20000);
      }
    } catch (err) {
      showActionStatus({ ok: false, msg: '❌ ' + err.message }, 20000);
    } finally {
      setActiveAction(null);
    }
  };

  // Trigger Profile Sync
  const handleSyncProfile = async () => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    setActiveAction('sync_profile');
    setActionStatusMsg(null);
    try {
      const res = await fetch('/api/garmin-profile-sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showActionStatus({ ok: true, msg: '✅ ' + data.message }, 60000);
        fetchTokenStatus();
      } else {
        showActionStatus({ ok: false, msg: '❌ ' + (data.error || 'Profile sync failed') }, 20000);
      }
    } catch (err) {
      showActionStatus({ ok: false, msg: '❌ ' + err.message }, 20000);
    } finally {
      setActiveAction(null);
    }
  };

  const getStatusBadge = () => {
    if (loadingStatus) {
      return <span className={`${styles.badge} ${styles.badgeMissing}`}>Checking…</span>;
    }
    if (!tokenInfo?.hasToken) {
      return (
        <span className={`${styles.badge} ${styles.badgeMissing}`}>
          <span className={styles.pulseDot} style={{ color: '#94a3b8' }} />
          Not Configured
        </span>
      );
    }
    if (tokenInfo.status === 'valid') {
      return (
        <span className={`${styles.badge} ${styles.badgeValid}`}>
          <span className={styles.pulseDot} style={{ color: '#10b981' }} />
          Connected & Valid
        </span>
      );
    }
    if (tokenInfo.status === 'expiring_soon') {
      return (
        <span className={`${styles.badge} ${styles.badgeExpiringSoon}`}>
          <span className={styles.pulseDot} style={{ color: '#f59e0b' }} />
          Expiring Soon
        </span>
      );
    }
    return (
      <span className={`${styles.badge} ${styles.badgeExpired}`}>
        <span className={styles.pulseDot} style={{ color: '#ef4444' }} />
        Token Expired
      </span>
    );
  };

  return (
    <div className={`animate-fadeup ${styles.page}`}>
      {/* Clean Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.garminLogoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l-8-4 8-4 8 4-8 4zm0 3.5l-8-4v3l8 4 8-4v-3l-8 4z" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Garmin Connect</h1>
            <p className={styles.subtitle}>Activity and biometrics sync integration</p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Live Action Notification */}
      {actionStatusMsg && (
        <div
          className={`${styles.alert} ${
            actionStatusMsg.ok ? styles.alertSuccess : styles.alertError
          }`}
        >
          <div style={{ wordBreak: 'break-word', flex: 1 }}>{actionStatusMsg.msg}</div>
          <button
            type="button"
            onClick={() => {
              if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
              setActionStatusMsg(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: '4px',
              opacity: 0.75,
              flexShrink: 0,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error / Success Messages */}
      {errorMsg && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className={`${styles.alert} ${styles.alertSuccess}`}>
          <span>✓ {successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Single Card */}
      <div className={styles.card}>
        {tokenInfo?.status === 'valid' && !showReauth ? (
          /* ── 1. Connected & Active View ─────────────────────────────────── */
          <div>
            <div className={styles.connectedHeader}>
              <div className={styles.checkCircle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h3 className={styles.connectedTitle}>Garmin Account Connected</h3>
                <p className={styles.connectedSub}>Live session is active and stored in database</p>
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Session Status</span>
                <span className={styles.metaValue} style={{ color: '#34d399' }}>Active & Ready</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Lifespan</span>
                <span className={styles.metaValue}>
                  {tokenInfo?.expiresInHours ? `${tokenInfo.expiresInHours} hrs` : '--'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Auto-Refresh</span>
                <span className={styles.metaValue}>
                  {tokenInfo?.hasRefreshToken ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button
                className="btn btn-primary"
                onClick={handleTestConnection}
                disabled={actionLoading}
              >
                {activeAction === 'test' ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                    Testing…
                  </>
                ) : (
                  <>
                    <IconRefresh /> Test Connection
                  </>
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleSyncActivities}
                disabled={actionLoading}
              >
                {activeAction === 'sync_runs' ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                    Syncing Runs…
                  </>
                ) : (
                  <>🏃 Sync Runs</>
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleSyncProfile}
                disabled={actionLoading}
              >
                {activeAction === 'sync_profile' ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                    Syncing Profile…
                  </>
                ) : (
                  <>👤 Sync Profile</>
                )}
              </button>
            </div>

            <div className={styles.cardFooter}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Account synced to Supabase
              </span>
              <button
                type="button"
                className={styles.reauthBtn}
                onClick={() => setShowReauth(true)}
              >
                🔄 Re-authenticate
              </button>
            </div>
          </div>
        ) : !sessionId ? (
          /* ── 2. Login Form ──────────────────────────────────────────────── */
          <div>
            <h2 className={styles.formTitle}>
              {showReauth ? 'Re-authenticate Garmin Account' : 'Connect Garmin Account'}
            </h2>
            <p className={styles.formDesc}>
              Enter your Garmin Connect credentials to establish a secure OAuth connection.
            </p>

            <form onSubmit={handleLogin} autoComplete="off">
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Garmin Email</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="off"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Garmin Password</label>
                <div className={styles.inputWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.inputField}
                    placeholder="Enter your Garmin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className={styles.togglePassBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                {showReauth && tokenInfo?.status === 'valid' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowReauth(false);
                      setErrorMsg(null);
                    }}
                    disabled={submitting}
                    style={{ flexShrink: 0 }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting || !email || !password}
                >
                  {submitting ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16 }} />
                      Authenticating…
                    </>
                  ) : (
                    <>
                      <IconLock />
                      Log In & Connect
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ── 3. MFA Screen ──────────────────────────────────────────────── */
          <div className={styles.mfaBox}>
            <div className={styles.mfaIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h3 className={styles.mfaTitle}>Two-Factor Authentication</h3>
            <p className={styles.mfaDesc}>
              {mfaPromptMsg || 'Enter the 6-digit verification code sent to your email or Garmin app.'}
            </p>

            <div style={{ fontSize: '12px', color: mfaSecondsLeft < 60 ? '#ef4444' : '#94a3b8', marginBottom: '14px' }}>
              ⏱️ Expires in: <strong>{Math.floor(mfaSecondsLeft / 60)}:{(mfaSecondsLeft % 60).toString().padStart(2, '0')}</strong>
            </div>

            <form onSubmit={handleMfaSubmit}>
              <input
                ref={otpInputRef}
                type="text"
                maxLength={6}
                className={styles.otpInput}
                placeholder="------"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                disabled={submitting}
                required
              />

              <div className={styles.mfaActions}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancelMfa}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || mfaCode.length < 6}
                  style={{ flex: 2 }}
                >
                  {submitting ? 'Verifying…' : 'Verify & Connect'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
