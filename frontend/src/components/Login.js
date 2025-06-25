import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HeartIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';

const Login = () => {
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(role, password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-romantic-50 p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center items-center mb-6">
            <HeartIcon className="h-12 w-12 text-primary-500 mr-3" />
            <MusicalNoteIcon className="h-12 w-12 text-romantic-500" />
          </div>
          <h2 className="text-4xl font-romantic font-bold text-gray-900 mb-2">
            Suno Na
          </h2>
          <p className="text-lg text-gray-600 font-medium">
            Private Music Sharing
          </p>
          <p className="text-sm text-gray-500 mt-2">
            A special place for Muskan & Vinay
          </p>
        </div>

        {/* Login Form */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Who are you?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('M')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    role === 'M'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-primary-300 hover:bg-primary-25'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">M</div>
                    <div className="text-sm font-medium">Muskan</div>
                    <div className="text-xs text-gray-500">Sender</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('V')}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    role === 'V'
                      ? 'border-romantic-500 bg-romantic-50 text-romantic-700'
                      : 'border-gray-300 hover:border-romantic-300 hover:bg-romantic-25'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">V</div>
                    <div className="text-sm font-medium">Vinay</div>
                    <div className="text-xs text-gray-500">Listener</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!role || !password || loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                !role 
                  ? 'bg-gray-400 text-gray-100 cursor-not-allowed'
                  : role === 'M'
                    ? 'btn-primary'
                    : 'btn-secondary'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>💕 A private space for two hearts 💕</p>
        </div>
      </div>
    </div>
  );
};

export default Login; 