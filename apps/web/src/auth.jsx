import { createContext, useContext, useEffect, useState } from 'react';
import { api, refreshSession, setSessionHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionHandler((u, t) => {
      setUser(u);
      setToken(t);
    });
    refreshSession().finally(() => setLoading(false));
  }, []);

  const value = {
    user,
    token,
    loading,
    login: api.login,
    register: api.register,
    logout: api.logout,
    isSetter: !!user && (user.role === 'setter' || user.role === 'admin'),
    isAdmin: !!user && user.role === 'admin',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
