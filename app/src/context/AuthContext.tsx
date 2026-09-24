import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, clearToken, getToken, loadWorkspace, login as apiLogin, logout as apiLogout, type WorkspaceSnapshot } from '../api';
import { hydrateWorkspaceData } from '../mockData';
import type { AuthUser } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  snapshot: WorkspaceSnapshot | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const session = getToken();
    try {
      const next = await loadWorkspace();
      if (session !== getToken()) return; // A response from a revoked session must not restore access.
      hydrateWorkspaceData(next); setSnapshot(next); setError('');
    } catch (reason) {
      if (session === getToken() && reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearToken(); setSnapshot(null);
      }
      throw reason;
    }
  }, []);
  useEffect(() => {
    localStorage.removeItem('ragguage_auth_user'); // Remove the supplied prototype identity.
    if (!getToken()) { setLoading(false); return; }
    refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Workspace unavailable.'))
      .finally(() => setLoading(false));
  }, [refresh]);
  const login = async (username: string, password: string) => {
    setError('');
    await apiLogin(username, password);
    await refresh();
  };
  const logout = async () => {
    try { await apiLogout(); }
    catch { /* Local credentials are cleared even if the API is offline. */ }
    finally { setSnapshot(null); setError(''); }
  };
  const user = useMemo<AuthUser | null>(() => snapshot ? {
    name: snapshot.user.username, email: snapshot.user.username,
    role: snapshot.user.role, organization: 'default workspace',
  } : null, [snapshot]);
  return <AuthContext.Provider value={{ user, snapshot, isAuthenticated: Boolean(snapshot), loading, error, login, logout, refresh }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
};
