import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Home from './pages/Home';
import Navigation from './pages/Navigation';
import ReportIncident from './pages/ReportIncident';
import BlindMode from './pages/BlindMode';
import Login from './pages/Login';
import SOSButton from './components/SOSButton';
import ErrorBoundary from './components/ErrorBoundary';
import GuardianMonitor from './components/GuardianMonitor';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

function AppContent() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  return (
    <div className={`relative min-h-screen font-sans transition-colors duration-300 ${isDarkMode ? 'bg-black text-white' : 'bg-blue-50/10 text-slate-900'}`}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/navigate"
          element={
            <ProtectedRoute>
              <Navigation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <ReportIncident />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blind-mode"
          element={
            <ProtectedRoute>
              <BlindMode />
            </ProtectedRoute>
          }
        />
      </Routes>
      {user && <SOSButton />}
      {user && <GuardianMonitor />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
