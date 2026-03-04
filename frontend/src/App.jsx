import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { ChatProvider } from './contexts/ChatContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DevMode from './pages/DevMode';
import BetaDashboard from './pages/BetaDashboard';
import Beta2Dashboard from './pages/Beta2Dashboard';
import MarketShareGuide from './pages/MarketShareGuide';
import PromotionGuide from './pages/PromotionGuide';
import RegulationGuide from './pages/RegulationGuide';
import IntelligenceGuide from './pages/IntelligenceGuide';
import { Spinner } from './components/common';

function ProtectedRoute({ children, adminOnly = false, betaOnly = false }) {
  const { isAuthenticated, isAdmin, isBeta, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (betaOnly && !isBeta) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { isAuthenticated, isBeta, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-overlay">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <p className="text-surface-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TutorialProvider>
      <ChatProvider>
        <div className="min-h-screen gradient-overlay">
          <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to={isBeta ? "/beta2" : "/"} replace /> : <Login />
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dev"
            element={
              <ProtectedRoute adminOnly>
                <DevMode />
              </ProtectedRoute>
            }
          />

          <Route
            path="/market-share-guide"
            element={
              <ProtectedRoute>
                <MarketShareGuide />
              </ProtectedRoute>
            }
          />

          <Route
            path="/promotion-guide"
            element={
              <ProtectedRoute>
                <PromotionGuide />
              </ProtectedRoute>
            }
          />

          <Route
            path="/regulation-guide"
            element={
              <ProtectedRoute>
                <RegulationGuide />
              </ProtectedRoute>
            }
          />

          <Route
            path="/intelligence-guide"
            element={
              <ProtectedRoute>
                <IntelligenceGuide />
              </ProtectedRoute>
            }
          />

          <Route
            path="/beta"
            element={
              <ProtectedRoute betaOnly>
                <BetaDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/beta2"
            element={
              <ProtectedRoute betaOnly>
                <Beta2Dashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ChatProvider>
    </TutorialProvider>
  );
}

export default App;