'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

// SVG Icons
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
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

  // MFA states (stored in Supabase garmin_login_sessions)
  const [sessionId, setSessionId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPromptMsg, setMfaPromptMsg] = useState('');
  const [mfaSecondsLeft, setMfaSecondsLeft] = useState(300);
  const otpInputRef = useRef(null);

  // Advanced raw JSON state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawTokensJson, setRawTokensJson] = useState('');
  const [rawSaving, setRawSaving] = useState(false);

  // Action status (Testing / Syncing)
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

  // Handle Primary Login Submission (Step 1)
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
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let data = {};
      try {
        const rawText = await res.text();
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (data.needs_mfa) {
        setSessionId(data.session_id);
        setMfaPromptMsg(data.message || 'MFA code sent to your email / authenticator app');
        setMfaCode('');
      } else if (data.success) {
        setSuccessMsg(data.message || 'Login successful! Fresh tokens saved to database.');
        setPassword('');
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

  // Handle 2FA / MFA Submission (Step 2)
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
          session_id: sessionId,
          otp_code: mfaCode.trim(),
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

  // Save Raw JSON Tokens to Supabase DB
  const handleSaveRawTokens = async () => {
    if (!rawTokensJson.trim()) return;
    setRawSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/garmin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_raw_tokens', tokensJson: rawTokensJson.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Tokens saved to database successfully!');
        setRawTokensJson('');
        fetchTokenStatus();
      } else {
        setErrorMsg(data.error || 'Failed to save raw tokens.');
      }
    } catch (err) {
      setErrorMsg('Error saving tokens: ' + err.message);
    } finally {
      setRawSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (activeAction === 'test') {
      return (
        <span className={`${styles.badge} ${styles.badgeValid}`}>
          <span className="spinner" style={{ width: 10, height: 10, marginRight: 6, display: 'inline-block' }} />
          Testing API…
        </span>
      );
    }
    if (activeAction === 'sync_runs') {
      return (
        <span className={`${styles.badge} ${styles.badgeValid}`}>
          <span className="spinner" style={{ width: 10, height: 10, marginRight: 6, display: 'inline-block' }} />
          Syncing Runs…
        </span>
      );
    }
    if (activeAction === 'sync_profile') {
      return (
        <span className={`${styles.badge} ${styles.badgeValid}`}>
          <span className="spinner" style={{ width: 10, height: 10, marginRight: 6, display: 'inline-block' }} />
          Syncing Profile…
        </span>
      );
    }
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
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <h1 className="page-title">
            <span className="text-gradient">Garmin Connect</span> Authentication & Hub
          </h1>
          <p className={styles.subtitle}>
            Authenticate with Garmin directly from this web page, manage access tokens in Supabase DB, and trigger live background sync.
          </p>
        </div>
      </div>

      {/* Top Status Cards */}
      <div className={styles.statusGrid}>
        {/* Card 1: Token Health */}
        <div
          className={`${styles.statusCard} ${
            tokenInfo?.status === 'valid'
              ? styles.statusCardValid
              : tokenInfo?.status === 'expired'
              ? styles.statusCardExpired
              : tokenInfo?.status === 'expiring_soon'
              ? styles.statusCardExpiringSoon
              : styles.statusCardMissing
          }`}
        >
          <div>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <IconShield /> Token Status
              </span>
              {getStatusBadge()}
            </div>

            <div className={styles.statusMainInfo}>
              <div className={styles.statusHeadline}>
                {activeAction === 'test'
                  ? 'Testing Garmin Connection…'
                  : activeAction === 'sync_runs'
                  ? 'Syncing Running Activities…'
                  : activeAction === 'sync_profile'
                  ? 'Synchronizing Profile & Sleep…'
                  : loadingStatus
                  ? 'Checking token in database…'
                  : tokenInfo?.status === 'valid'
                  ? 'Garmin API Active'
                  : tokenInfo?.status === 'expired'
                  ? 'Re-Authentication Required'
                  : 'No Active Token in Database'}
              </div>
              <div className={styles.statusDesc}>
                {activeAction
                  ? 'Communicating with Garmin Connect cloud servers in real-time. Please wait a moment…'
                  : tokenInfo?.status === 'valid'
                  ? 'Your Garmin session is active. Background sync can fetch your latest runs and health metrics.'
                  : tokenInfo?.status === 'expired'
                  ? 'Your Garmin refresh token expired. Log in below to generate fresh credentials.'
                  : 'Enter your Garmin Connect credentials below to initialize access tokens.'}
              </div>
            </div>

            <div className={styles.metaList}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Token Expiry</span>
                <span className={styles.metaValue}>
                  {tokenInfo?.expiresAt
                    ? new Date(tokenInfo.expiresAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '--'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Lifespan Remaining</span>
                <span className={styles.metaValue}>
                  {tokenInfo?.expiresInHours !== null && tokenInfo?.expiresInHours !== undefined
                    ? tokenInfo.expiresInHours > 0
                      ? `${tokenInfo.expiresInHours} hrs`
                      : 'Expired'
                    : '--'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Refresh Token</span>
                <span className={styles.metaValue}>
                  {tokenInfo?.hasRefreshToken ? '✅ Available' : '❌ Missing'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button
              className="btn btn-primary"
              onClick={handleTestConnection}
              disabled={actionLoading || !tokenInfo?.hasToken}
              title="Test connection with Garmin Connect API"
            >
              {activeAction === 'test' ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                  <span>Testing Connection…</span>
                </>
              ) : (
                <>
                  <IconRefresh /> Test Connection
                </>
              )}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleSyncActivities}
              disabled={actionLoading || !tokenInfo?.hasToken}
            >
              {activeAction === 'sync_runs' ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                  <span>🏃 Syncing Runs…</span>
                </>
              ) : (
                <>🏃 Sync Runs</>
              )}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleSyncProfile}
              disabled={actionLoading || !tokenInfo?.hasToken}
            >
              {activeAction === 'sync_profile' ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block' }} />
                  <span>👤 Syncing Profile…</span>
                </>
              ) : (
                <>👤 Sync Profile</>
              )}
            </button>
          </div>

          {actionStatusMsg && (
            <div
              className={`${styles.alert} ${
                actionStatusMsg.ok ? styles.alertSuccess : styles.alertError
              }`}
              style={{
                marginTop: '14px',
                marginBottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
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
                title="Close notification"
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Security & Info */}
        <div className={styles.statusCard}>
          <div>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <IconLock /> Security & Auto-Sync
              </span>
            </div>
            <div className={styles.statusHeadline}>Direct Garmin OAuth & Database</div>
            <p className={styles.statusDesc}>
              This dashboard connects directly to official Garmin Connect APIs. Tokens are securely encrypted and stored in your Supabase DB.
            </p>

            <ul className={styles.infoList} style={{ marginTop: '16px' }}>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>2FA / MFA Support:</strong> Enter your 6-digit email or authenticator OTP code seamlessly on this page.
                </span>
              </li>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>Automatic Refresh:</strong> OAuth tokens are renewed silently in the background while active.
                </span>
              </li>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>Database Storage:</strong> Tokens are stored in table <code>garmin_tokens</code> in Supabase.
                </span>
              </li>
            </ul>
          </div>

          <div style={{ marginTop: '20px' }}>
            <Link href="/history" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
              View Run History →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Form & Column */}
      <div className={styles.mainLayout}>
        {/* Left: Login Card */}
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.garminLogoIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l-8-4 8-4 8 4-8 4zm0 3.5l-8-4v3l8 4 8-4v-3l-8 4z" />
              </svg>
            </div>
            <div>
              <h2 className={styles.loginTitle}>Garmin Account Authentication</h2>
              <p className={styles.loginSub}>Enter your Garmin Connect email & password</p>
            </div>
          </div>

          {/* Alert messages */}
          {errorMsg && (
            <div className={`${styles.alert} ${styles.alertError}`}>
              <span>⚠️</span>
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className={`${styles.alert} ${styles.alertSuccess}`}>
              <IconCheck />
              <div>{successMsg}</div>
            </div>
          )}

          {/* STEP 1: Email & Password Form */}
          {!sessionId ? (
            <form onSubmit={handleLogin}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Garmin Connect Email / Username</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="email"
                    className={styles.inputField}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
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
                    autoComplete="current-password"
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

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting || !email || !password}
              >
                {submitting ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18 }} />
                    <span>Authenticating with Garmin…</span>
                  </>
                ) : (
                  <>
                    <IconLock />
                    <span>Log In & Refresh Token</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: MFA Verification Screen */
            <div className={styles.mfaBox}>
              <div className={styles.mfaIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 17H2a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2Z" />
                  <path d="m22 4-10 7L2 4" />
                </svg>
              </div>

              <h3 className={styles.mfaTitle}>Two-Factor Authentication (2FA)</h3>
              <p className={styles.mfaDesc}>
                {mfaPromptMsg || 'Garmin sent a 6-digit verification code to your email or Garmin Authenticator. Please enter it below.'}
              </p>

              <div style={{ fontSize: '12px', color: mfaSecondsLeft < 60 ? '#ef4444' : '#94a3b8', marginBottom: '12px', textAlign: 'center' }}>
                ⏱️ Session expires in: <strong>{Math.floor(mfaSecondsLeft / 60)}:{(mfaSecondsLeft % 60).toString().padStart(2, '0')}</strong>
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
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || mfaCode.length < 6}
                    style={{ flex: 1 }}
                  >
                    {submitting ? 'Verifying…' : 'Verify & Log In'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right: Quick Instructions & FAQ */}
        <div className={styles.infoColumn}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>💡 How it Works</div>
            <ul className={styles.infoList}>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>Full Web Login:</strong> Enter your credentials here on the web. If 2FA is enabled, the 6-digit OTP code prompt will appear right here.
                </span>
              </li>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>Direct Database Storage:</strong> Upon successful login, tokens are automatically stored into your Supabase database table <code>garmin_tokens</code>.
                </span>
              </li>
              <li className={styles.infoListItem}>
                <span className={styles.infoDot} />
                <span>
                  <strong>Error 429 (Too Many Requests):</strong> Garmin temporarily limits login attempts if triggered repeatedly. Wait 5-10 minutes before retrying if rate limited.
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>⚡ Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/history" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                🏃 Run History & Activities
              </Link>
              <Link href="/profile" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                👤 Runner Profile & Biometrics
              </Link>
              <Link href="/dashboard" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                📊 Analytics Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Token Paste Accordion */}
      <div className={styles.advancedSection}>
        <div
          className={styles.advancedHeader}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <div className={styles.advancedTitle}>
            <span>⚙️ Advanced: Paste or Update Raw Token JSON</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {showAdvanced ? '▲ Collapse' : '▼ Expand'}
          </span>
        </div>

        {showAdvanced && (
          <div className={styles.advancedBody}>
            <p className={styles.subtitle} style={{ marginBottom: 12 }}>
              If you have tokens generated from another machine, you can paste the JSON object here to save directly into Supabase:
            </p>

            <textarea
              className={styles.rawTextarea}
              placeholder={`{\n  "di_token": "eyJhbG...",\n  "di_refresh_token": "...",\n  "di_client_id": "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2"\n}`}
              value={rawTokensJson}
              onChange={(e) => setRawTokensJson(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveRawTokens}
                disabled={rawSaving || !rawTokensJson.trim()}
              >
                {rawSaving ? 'Saving to Database…' : 'Apply & Save Tokens to DB'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
