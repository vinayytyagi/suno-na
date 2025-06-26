import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LocationProvider } from './contexts/LocationContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import MVSplash from './components/LoveDoveeLoader';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationBar from './components/NotificationBar';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Main App Component
const AppContent = () => {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash for 1.7s only on first mount
    const timer = setTimeout(() => setShowSplash(false), 1700);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <MVSplash text="Pyaar se loading ho raha hai..." />;
  }
  if (loading) {
    return null;
  }
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-romantic-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
};

// App Component with Providers
function App() {
  return (
    <NotificationProvider>
      <LocationProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationBar />
            <AppContent />
          </SocketProvider>
        </AuthProvider>
      </LocationProvider>
    </NotificationProvider>
  );
}

export default App;
