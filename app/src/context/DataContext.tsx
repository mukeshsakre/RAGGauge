import React, { createContext, useContext } from 'react';
import type { WorkspaceSnapshot } from '../api';

interface DataContextValue {
  snapshot: WorkspaceSnapshot;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({
  value,
  children,
}: {
  value: DataContextValue;
  children: React.ReactNode;
}) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useRAGGauge() {
  const value = useContext(DataContext);
  if (!value) throw new Error('useRAGGauge must be used within DataProvider');
  return value;
}
