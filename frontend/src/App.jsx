import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { MessageSquare, Loader2 } from 'lucide-react';

const LoadingScreen = () => (
  <div className="h-screen w-screen flex flex-col items-center justify-center bg-cs-bg text-cs-text-primary transition-colors duration-200">
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25 animate-pulse">
      <MessageSquare size={26} />
    </div>
    <div className="flex items-center gap-2.5 text-sm font-semibold text-cs-text-secondary">
      <Loader2 size={16} className="animate-spin text-cs-accent" />
      <span className="tracking-tight font-heading">Initializing ChatSphere...</span>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
