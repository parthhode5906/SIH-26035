import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck, UserRound, WifiOff } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import Button from '@/components/Button';
import { api, setTokens } from '@/api/client';

export function Login() {
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('technician@nawi.local');
  const [password, setPassword] = useState('nawi-demo');
  const [error, setError] = useState('');

  const continueLocally = () => {
    // Local drafts remain usable offline, but no fake server identity is created.
    localStorage.setItem('nawi-authenticated', '1');
    localStorage.setItem('nawi-local-mode', '1');
    window.location.href = '/dashboard';
  };

  const continueWithOrganization = async () => {
    setSigningIn(true); setError('');
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
    <div className="login-shell grain min-h-[100dvh] bg-[#17333c] text-[#f4f7f3]">
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-25 grid-paper-dark" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#c69852] bg-[#17333c] overflow-hidden">
              <img src={logoImg} alt="NAWI Logo" className="h-full w-full object-cover" onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} />
              <span className="font-mono text-base font-bold text-[#c69852]">N</span>
            </div>
            <div>
              <div className="wordmark text-[#eff5ee]">NAWI</div>
              <div className="mt-1 text-[9px] uppercase tracking-[.16em] text-[#9cb5ae]">
                Compliance suite
              </div>
            </div>
          </div>
          <div className="relative max-w-md">
            <div className="eyebrow !text-[#c8a96b]">Offline-first metrology workspace</div>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-.05em] text-[#f4f7f3]">
              Measure with a record you can defend.
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-[#a5c0b8]">
              Run OIML R-76 verification workflows, preserve the bench trail, and issue tamper-evident reports from the technician’s desk.
            </p>
          </div>
          <div className="relative flex items-center justify-between text-[10px] uppercase tracking-[.16em] text-[#6e928b]">
            <span>OIML R-76 / R 76-2:2007</span>
            <span>Facility 07 · Bench 02</span>
          </div>
        </section>

        <main className="flex items-center bg-[#edf3ee] px-5 py-10 text-[#17333c] sm:px-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#c69852] bg-[#17333c] overflow-hidden">
                <img src={logoImg} alt="NAWI Logo" className="h-full w-full object-cover" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }} />
                <span className="font-mono text-base font-bold text-[#c69852]">N</span>
              </div>
              <div>
                <div className="wordmark">NAWI</div>
                <div className="mt-1 text-[9px] uppercase tracking-[.16em] text-[#66837d]">
                  Compliance suite
                </div>
              </div>
            </div>

            <div className="eyebrow">Secure workspace access</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Sign in to the bench.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#58746f]">
              Access is used to associate sealed reports with an accountable operator. Local drafts remain available on this device.
            </p>

            <div className="panel mt-8 p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-md border border-[#d7e0db] bg-[#f8fbf8] p-4">
                <UserRound size={17} className="mt-0.5 shrink-0 text-[#2e7568]" />
                <div>
                  <div className="text-sm font-semibold">Operator access</div>
                  <div className="mt-1 text-xs leading-5 text-[#66837d]">
                    Use your organization sign-in when connected, or continue in local mode for offline bench work.
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="eyebrow">Email</span><input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c69852]" /></label>
                <label className="sm:col-span-2"><span className="eyebrow">Password</span><input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c69852]" /></label>
              </div>
              {error && <div className="mt-3 rounded-md border border-[#e7b5ae] bg-[#fff5f3] p-3 text-xs text-[#a6423b]">{error}</div>}

              <button
                onClick={continueWithOrganization}
                disabled={signingIn}
                className="button-primary mt-5 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-70"
                data-testid="button-organization-login"
              >
                <ShieldCheck size={16} />
                {signingIn ? 'Opening secure sign-in…' : 'Use organization sign-in'}
              </button>

              <button
                onClick={continueLocally}
                className="button-quiet mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold"
                data-testid="button-local-login"
              >
                <WifiOff size={15} />
                Continue in local mode
              </button>

              <div className="mt-5 flex items-start gap-2 border-t border-[#d7e0db] pt-4 text-[10px] leading-5 text-[#7b9690]">
                <LockKeyhole size={13} className="mt-0.5 shrink-0 text-[#2e7568]" />
                <span>
                  Local mode stores working records in this browser. A report is only treated as sealed after its signature hash is recorded.
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-[10px] text-[#7b9690]">
              <span>NAWI Compliance Suite</span>
              <span className="font-mono">v2.4.1</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Login;
