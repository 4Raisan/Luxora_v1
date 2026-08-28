import { useState } from 'react';
import { apiRequest } from '../services/api';

export default function AccountVerificationPanel({ currentUser }) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

  const handleSendEmailVerification = async () => {
    if (!currentUser?.email) {
      setEmailMsg({ type: 'error', text: 'No email address found for this account.' });
      return;
    }
    setEmailSending(true);
    setEmailMsg({ type: '', text: '' });
    try {
      const token = sessionStorage.getItem('token');
      await apiRequest('/auth/password-reset/request', 'POST', { email: currentUser.email }, token);
      setEmailMsg({
        type: 'success',
        text: 'A verification & security link has been sent via Resend to ' + currentUser.email,
      });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message || 'Could not send verification email.' });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div
      className="cd-verification-panel"
      style={{
        background: '#121215',
        border: '1px solid rgba(201, 168, 76, 0.22)',
        borderRadius: '12px',
        padding: '1.2rem',
        marginTop: '1.25rem',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h4
          style={{
            margin: 0,
            color: 'var(--gold, #c9a84c)',
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          ACCOUNT VERIFICATION
        </h4>
        <p style={{ margin: '0.2rem 0 0 0', color: '#777', fontSize: '0.74rem' }}>
          Official verification status for your registered account
        </p>
      </div>

      {/* ── EMAIL VERIFICATION ── */}
      <div
        style={{
          background: '#0a0a0c',
          border: '1px solid #222',
          borderRadius: '8px',
          padding: '0.85rem 1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 700 }}>
            EMAIL ADDRESS
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            VERIFIED ✓
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
          }}
        >
          <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
            {currentUser?.email || 'No email attached'}
          </span>
          <button
            type="button"
            onClick={handleSendEmailVerification}
            disabled={emailSending}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid #333',
              color: '#ccc',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: emailSending ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            {emailSending ? 'SENDING...' : 'VERIFY EMAIL'}
          </button>
        </div>

        {emailMsg.text && (
          <div
            style={{
              marginTop: '0.65rem',
              fontSize: '0.74rem',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              color: emailMsg.type === 'success' ? '#22c55e' : '#ef4444',
              background:
                emailMsg.type === 'success'
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
              border:
                emailMsg.type === 'success'
                  ? '1px solid rgba(34,197,94,0.2)'
                  : '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {emailMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
