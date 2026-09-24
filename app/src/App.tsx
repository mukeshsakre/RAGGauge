/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StreamlitShell } from './components/layout/StreamlitShell';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
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

function AppContent() {
  const { snapshot, loading, error, refresh, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [navParams, setNavParams] = useState<Record<string, any>>({});

  const handleNavigate = (screen: ScreenId, params: Record<string, any> = {}) => {
    setNavParams(params);
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderScreen = () => {
    if (snapshot?.user.role === 'VIEWER' && ['create_dataset', 'new_experiment', 'pipeline_lab'].includes(currentScreen)) {
      return <p role="status" className="p-6 text-zinc-300">VIEWER access is read-only. An ENGINEER or ADMIN can create datasets and experiments.</p>;
    }
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onNavigate={handleNavigate} />;
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
        return <NewExperimentScreen onNavigate={handleNavigate} initialMode={navParams.mode} initialDatasetId={navParams.datasetId} initialAdapterId={navParams.adapterId} />;
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
      case 'configuration':
      case 'settings':
        return <SettingsScreen onNavigate={handleNavigate} />;

      default:
        return <OverviewScreen onNavigate={handleNavigate} />;
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-zinc-300">Connecting to the local API…</div>;
  if (!snapshot) return <LoginScreen onNavigate={handleNavigate} initialError={error} />;
  return <DataProvider value={{ snapshot, refresh, signOut: logout }}>
    <StreamlitShell currentScreen={currentScreen} onNavigate={handleNavigate}>
      <div key={currentScreen + JSON.stringify(navParams)}>{renderScreen()}</div>
    </StreamlitShell>
  </DataProvider>;
}

export default function App() {
  return <ThemeProvider><ToastProvider><AuthProvider><AppContent /></AuthProvider></ToastProvider></ThemeProvider>;
}
