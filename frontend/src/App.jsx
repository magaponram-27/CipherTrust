import { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import ChatErrorBoundary from './components/ChatErrorBoundary';

export default function App() {
  const [user, setUser] = useState(null);

  function authenticate(authenticatedUser) {
    const { vaultKey: _vaultKey, identity: _identity, ...persistedUser } = authenticatedUser;
    localStorage.setItem('ciphertrust.user', JSON.stringify(persistedUser));
    setUser(authenticatedUser);
  }

  function logout() {
    localStorage.removeItem('ciphertrust.user');
    localStorage.removeItem('ciphertrust.token');
    setUser(null);
  }

  return user
    ? <ChatErrorBoundary onReset={logout}><Chat user={user} onLogout={logout} /></ChatErrorBoundary>
    : <Login onAuth={authenticate} />;
}
