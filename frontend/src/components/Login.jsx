import { useState } from 'react';
import { getMyPublicKey, login, register, updatePublicKey } from '../api';
import { createOrUnlockIdentity, deriveKey } from '../crypto';

export default function Login({ onAuth }) {
  const [username, setUsername] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ciphertrust.user') || '{}').username || ''; }
    catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(mode) {
    setError('');
    setBusy(true);
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const response = await (mode === 'register' ? register : login)({ username: normalizedUsername, password });
      localStorage.setItem('ciphertrust.token', response.token);
      const vaultKey = await deriveKey(password, normalizedUsername);
      const registeredIdentity = await getMyPublicKey();
      const identity = await createOrUnlockIdentity(vaultKey, normalizedUsername, registeredIdentity.publicKey);
      await updatePublicKey(identity.publicKey);
      onAuth({ ...response, username: normalizedUsername, vaultKey, identity });
    } catch (requestError) {
      localStorage.removeItem('ciphertrust.token');
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-8">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gray-950/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <section className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-teal-100/20 bg-teal-100/10 text-teal-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="15" r="1" fill="currentColor"/></svg>
              </div>
              <span className="font-semibold">Cipher<span className="text-teal-100">Trust</span></span>
            </div>
            <p className="text-sm font-medium text-teal-200">WELCOME TO CIPHERTRUST</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">A little more private.</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">Sign in or create an account to continue.</p>

            <form onSubmit={(event) => { event.preventDefault(); submit('login'); }} className="mt-9 space-y-5">
              <label className="block text-sm font-medium text-gray-300">Username
                <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" className="input-field mt-2.5" placeholder="your_username" />
              </label>
              <label className="block text-sm font-medium text-gray-300">Password
                <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} className="input-field mt-2.5" placeholder="At least 6 characters" />
              </label>
              {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm leading-6 text-red-200">{error}</p>}
              <div className="space-y-3 pt-2">
                <button disabled={busy} className="primary-button w-full rounded-xl px-4 py-3.5 font-semibold text-gray-950 transition disabled:cursor-wait disabled:opacity-50">{busy ? 'Please wait…' : 'Sign in'}</button>
                <button disabled={busy} type="button" onClick={() => submit('register')} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50">Create a new account</button>
              </div>
            </form>
            <div className="mt-7 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-gray-300"><span className="text-teal-200">✳</span> Your password never leaves this device.</p>
              <p className="mt-2 pl-6 text-xs leading-5 text-gray-500">Your encryption key is derived locally. Remember your password to unlock your device identity.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
