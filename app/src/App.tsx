/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StreamlitShell } from './components/layout/StreamlitShell';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { OverviewScreen } from './screens/OverviewScreen';
import { DatasetsScreen } from './screens/DatasetsScreen';
import { DatasetDetailScreen } from './screens/DatasetDetailScreen';
import { CreateDatasetScreen } from './screens/CreateDatasetScreen';
import { ExperimentsScreen } from './screens/ExperimentsScreen';
import { NewExperimentScreen } from './screens/NewExperimentScreen';
import { ExperimentRunningScreen } from './screens/ExperimentRunningScreen';
import { ExperimentDetailsScreen } from './screens/ExperimentDetailsScreen';
import { CaseDetailScreen } from './screens/CaseDetailScreen';
import { CompareExperimentsScreen } from './screens/CompareExperimentsScreen';
import { RegressionAnalysisScreen } from './screens/RegressionAnalysisScreen';
import { RecommendationScreen } from './screens/RecommendationScreen';
import { PipelineLabScreen } from './screens/PipelineLabScreen';
import { AdaptersScreen } from './screens/AdaptersScreen';
import { ModelsJudgesScreen } from './screens/ModelsJudgesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ScreenId } from './types';
import { ApiError, clearToken, getToken, loadWorkspace, login, logout, type WorkspaceSnapshot } from './api';
import { DataProvider } from './context/DataContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { hydrateWorkspaceData } from './mockData';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  const refresh = useCallback(async () => {
    const next = await loadWorkspace();
    hydrateWorkspaceData(next);
    setSnapshot(next);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    refresh()
      .catch((error) => {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          clearToken();
          setSessionMessage('Your session expired. Sign in again.');
        } else {
          setSessionMessage(error instanceof Error ? error.message : 'Unable to load the workspace.');
        }
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const handleLogin = async (username: string, password: string) => {
    await login(username, password);
    const next = await loadWorkspace();
    hydrateWorkspaceData(next);
    setSnapshot(next);
    setSessionMessage('');
  };

  const handleSignOut = async () => {
    await logout();
    setSnapshot(null);
    setCurrentScreen('overview');
    setNavParams({});
  };

  const handleNavigate = (screen: ScreenId, params: Record<string, any> = {}) => {
    setNavParams(params);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'overview':
        return <OverviewScreen onNavigate={handleNavigate} />;
      case 'datasets':
        return <DatasetsScreen onNavigate={handleNavigate} />;
      case 'dataset_detail':
        return <DatasetDetailScreen onNavigate={handleNavigate} datasetId={navParams.datasetId} />;
      case 'create_dataset':
        return <CreateDatasetScreen onNavigate={handleNavigate} />;
      case 'experiments':
        return <ExperimentsScreen onNavigate={handleNavigate} />;
      case 'new_experiment':
        return <NewExperimentScreen onNavigate={handleNavigate} initialMode={navParams.mode} initialDatasetId={navParams.datasetId} />;
      case 'experiment_running':
        return <ExperimentRunningScreen onNavigate={handleNavigate} experimentId={navParams.experimentId} />;
      case 'experiment_details':
        return <ExperimentDetailsScreen onNavigate={handleNavigate} experimentId={navParams.experimentId} />;
      case 'case_detail':
        return <CaseDetailScreen onNavigate={handleNavigate} caseId={navParams.caseId} runId={navParams.runId} />;
      case 'compare':
        return <CompareExperimentsScreen onNavigate={handleNavigate} selected={navParams.selected} />;
      case 'regression_analysis':
        return (
          <RegressionAnalysisScreen 
            onNavigate={handleNavigate} 
            baselineId={navParams.baselineId} 
            currentId={navParams.currentId} 
          />
        );
      case 'recommendation':
        return (
          <RecommendationScreen 
            onNavigate={handleNavigate} 
            baselineId={navParams.baselineId} 
            currentId={navParams.currentId} 
          />
        );
      case 'pipeline_lab':
        return <PipelineLabScreen onNavigate={handleNavigate} />;
      case 'adapters':
        return <AdaptersScreen onNavigate={handleNavigate} />;
      case 'models_judges':
        return <ModelsJudgesScreen onNavigate={handleNavigate} />;
      case 'settings':
        return <SettingsScreen onNavigate={handleNavigate} />;
      case 'configuration':
        return <SettingsScreen onNavigate={handleNavigate} />;
      default:
        return <OverviewScreen onNavigate={handleNavigate} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090E] text-slate-300 grid place-items-center">
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          Connecting to the local control plane…
        </div>
      </div>
    );
  }

  if (!snapshot) return <LoginScreen onLogin={handleLogin} initialError={sessionMessage} />;

  return (
    <ThemeProvider>
      <ToastProvider>
        <DataProvider value={{ snapshot, refresh, signOut: handleSignOut }}>
          <StreamlitShell currentScreen={currentScreen} onNavigate={handleNavigate}>
            {renderScreen()}
          </StreamlitShell>
        </DataProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
