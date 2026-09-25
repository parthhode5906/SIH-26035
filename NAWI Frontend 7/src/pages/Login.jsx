import React, { useState } from 'react';
import { BarChart3, FileText, LockKeyhole, Mail, ShieldCheck, WifiOff } from 'lucide-react';
import machineBg from '@/assets/login-scale.png';
import { api, setTokens } from '@/api/client';
import { NawiBrand } from '@/components/NawiBrand';

const features = [
  { icon: FileText, label: 'Structured records' },
  { icon: ShieldCheck, label: 'Rule-based evaluation', accent: true },
  { icon: BarChart3, label: 'Verifiable reports' },
];

export function Login() {
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('technician@nawi.local');
  const [password, setPassword] = useState('nawi-demo');
  const [error, setError] = useState('');

  const continueLocally = () => {
    localStorage.setItem('nawi-authenticated', '1');
    localStorage.setItem('nawi-local-mode', '1');
    window.location.href = '/dashboard';
  };

  const continueWithOrganization = async () => {
    setSigningIn(true);
    setError('');
    try {
      const data = await api.login(email, password);
      setTokens(data);
      localStorage.removeItem('nawi-local-mode');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
      setSigningIn(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual" aria-label="NAWI workspace introduction">
        <div className="login-dots" />
        <NawiBrand variant="login" className="login-brand" />

        <div className="login-hero-copy">
          <div className="login-eyebrow"><span />Digital inspection workspace</div>
          <h1>Measure with a record<br /><em>you can trust.</em></h1>
          <p>A structured workflow for non-automatic weighing instrument inspection, from evaluation to verifiable reports.</p>

          <div className="login-feature-row">
            {features.map(({ icon: Icon, label, accent }) => (
              <div className="login-feature" key={label}>
                <div className={`login-feature-icon ${accent ? 'accent' : ''}`}><Icon size={27} strokeWidth={1.8} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <img className="login-machine" src={machineBg} alt="Non-automatic weighing instrument" />

        <div className="login-footer-left">
          <span>OIML R-76 / R 76-2:2007</span>
          <span className="login-footer-rule" />
          <span>SIH 26035 · Legal Metrology Lab</span>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-form-card">
          <div className="login-card-heading">
            <div className="login-eyebrow"><span />Secure workspace access</div>
            <h2>Sign in to NAWI</h2>
            <p>Access your organization workspace to continue with inspection work.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void continueWithOrganization(); }}>
            <label className="login-field">
              <span>Email</span>
              <div className="login-input-wrap">
                <Mail size={20} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" placeholder="name@organization.local" />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input-wrap">
                <LockKeyhole size={20} />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
              </div>
            </label>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button type="submit" disabled={signingIn} className="login-submit" data-testid="button-organization-login">
              <span>{signingIn ? 'Signing in…' : 'Sign in'}</span>
              <span className="login-submit-arrow">→</span>
            </button>

            <button type="button" onClick={continueLocally} className="login-local" data-testid="button-local-login">
              <WifiOff size={19} />
              Continue in local mode
            </button>
          </form>

          <div className="login-note">
            <LockKeyhole size={18} />
            <span>Local mode stores working records in this browser. Reports are sealed after their integrity hash is recorded.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Login;
