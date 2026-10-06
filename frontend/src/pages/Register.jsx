import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { 
  MessageSquare, Lock, Mail, User, Sun, Moon, Eye, EyeOff, 
  Sparkles, CheckCircle2
} from 'lucide-react';

export const Register = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { register } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (username.length < 3) {
      return setError('Username must be at least 3 characters long.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setIsLoading(true);
    try {
      await register(fullName, username, email, password);
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1400);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-cs-bg text-cs-text-primary transition-colors duration-200">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 p-2.5 rounded-2xl bg-cs-surface border border-cs-border text-cs-text-secondary hover:text-cs-text-primary shadow-xs transition-colors focus-ring cursor-pointer"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-cs-text-secondary" />}
      </button>

      {/* Left Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 overflow-y-auto">
        <div className="w-full max-w-md bg-cs-surface p-8 sm:p-10 rounded-3xl border border-cs-border shadow-xl my-8">
          {/* Logo & Header */}
          <div className="mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-2xl font-bold font-heading text-cs-text-primary tracking-tight">
              Create an account
            </h2>
            <p className="mt-1 text-xs text-cs-text-muted">
              Get started with real-time distributed messaging on ChatSphere
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-cs-danger/10 border border-cs-danger/30 p-3 rounded-2xl text-xs text-cs-danger font-medium animate-in fade-in">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-cs-online/15 border border-cs-online/30 p-3 rounded-2xl text-xs text-cs-online font-medium animate-in fade-in">
              {success}
            </div>
          )}

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-cs-text-primary mb-1">
                Full Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-3.5 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
                  placeholder="e.g. Karan Mishra"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cs-text-primary mb-1">
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-3.5 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
                  placeholder="e.g. karanm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cs-text-primary mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-3.5 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
                  placeholder="karan@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cs-text-primary mb-1">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-10 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted hover:text-cs-text-primary focus-ring p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cs-text-primary mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cs-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full pl-10 pr-3.5 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center"
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-cs-border text-center text-xs text-cs-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-cs-accent hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Right Hero / Branding Column (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-12 flex-col justify-between relative overflow-hidden text-white border-l border-cs-border/40 select-none">
        {/* Decorative glow */}
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/60 border border-indigo-400/30 flex items-center justify-center">
            <MessageSquare size={20} className="text-white" />
          </div>
          <span className="text-lg font-bold font-heading tracking-tight">ChatSphere</span>
        </div>

        <div className="relative z-10 max-w-md my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-6">
            <Sparkles size={14} />
            <span>Fast, Resilient & Modern</span>
          </div>

          <h1 className="text-3xl font-extrabold font-heading leading-tight mb-4">
            A distributed chat built for modern collaboration.
          </h1>

          <p className="text-sm text-indigo-200/80 leading-relaxed mb-8">
            Create group rooms, connect 1-on-1, and experience real-time messaging with automatic recovery and seamless cross-node architecture.
          </p>

          <div className="space-y-3.5 text-xs text-indigo-100">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Multi-room Socket.IO broadcasting</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Deterministic gradients and polished design</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Full light and dark theme support</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-indigo-300/60 flex items-center justify-between">
          <span>ChatSphere Distributed System</span>
          <span>College Mini Project</span>
        </div>
      </div>
    </div>
  );
};

export default Register;
