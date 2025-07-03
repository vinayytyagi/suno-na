import React, { useState, useRef } from 'react';
import { 
  ArrowRightOnRectangleIcon, 
  HeartIcon, 
  MusicalNoteIcon, 
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useLocation } from '../contexts/LocationContext';
import axios from 'axios';
import SpinnerLoader from './SpinnerLoader';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { MdOndemandVideo } from 'react-icons/md';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Header = ({ user, onlineUsers, onLogout }) => {
  const isVinayOnline = onlineUsers.get('V') === 'online';
  const isMuskanOnline = onlineUsers.get('M') === 'online';
  const [devOpen, setDevOpen] = useState(false);
  const devBtnRef = useRef();
  const { muskanLocation, setMuskanLocation } = useLocation();
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { socket } = useSocket();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const navigate = useNavigate();

  // Fetch Muskan's location from backend when Vinay opens Settings
  React.useEffect(() => {
    if (user.role === 'V' && devOpen) {
      setLoadingLocation(true);
      setLocationError('');
      const token = localStorage.getItem('token') || '';
      axios.get(`${API_URL}/api/auth/users/muskan-location`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setMuskanLocation(res.data.location);
          console.log('Vinay: fetched Muskan location', res.data.location);
        })
        .catch(err => {
          setLocationError(err.response?.data?.message || 'Failed to fetch location');
        })
        .finally(() => setLoadingLocation(false));
    }
    // eslint-disable-next-line
  }, [user.role, devOpen]);

  // Handler for RT lcn
  const handleGetLocation = () => {
    if (user.role === 'V' && socket) {
      socket.emit('requestMuskanLocationUpdate');
    }
    setLoadingLocation(true);
    setLocationError('');
    const token = localStorage.getItem('token') || '';
    // Wait 1.5 seconds to allow Muskan's browser to update location
    setTimeout(() => {
      axios.get(`${API_URL}/api/auth/users/muskan-location`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          setMuskanLocation(res.data.location);
          console.log('Vinay: fetched Muskan location', res.data.location);
        })
        .catch(err => {
          setLocationError(err.response?.data?.message || 'Failed to fetch location');
        })
        .finally(() => {
          setLoadingLocation(false);
    setDevOpen(false);
        });
    }, 1500);
  };

  return (
    <header className="bg-white/60 backdrop-blur-md shadow-sm border-b border-gray-200 fixed top-0 left-0 w-full z-30">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center">
              <HeartIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary-500 mr-1 sm:mr-2" />
              <MusicalNoteIcon className="h-7 w-7 sm:h-8 sm:w-8 text-romantic-500" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-romantic font-bold text-gray-900">
                Suno Na
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Private Music Sharing
              </p>
            </div>
          </div>

          {/* Hamburger for mobile */}
          <button
            className="md:hidden flex items-center p-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-300"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6 text-gray-700" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-gray-700" />
            )}
          </button>

          {/* Right section: status, user, settings, logout (hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-4 sm:space-x-8">
            {/* Both Users' Status */}
            <div className="flex items-center space-x-3 sm:space-x-6 bg-gray-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-gray-200 shadow-sm">
              {/* Muskan Status */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-700 mb-0.5 sm:mb-1">Muskan</span>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${isMuskanOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className={`text-xs font-medium ${isMuskanOnline ? 'text-green-600' : 'text-gray-400'}`}>{isMuskanOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              {/* Vinay Status */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-700 mb-0.5 sm:mb-1">Vinay</span>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${isVinayOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className={`text-xs font-medium ${isVinayOnline ? 'text-green-600' : 'text-gray-400'}`}>{isVinayOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>

            {/* Current User */}
            <div className="text-right">
              <div className="text-xs sm:text-sm font-medium text-gray-900">
                {user.role === 'M' ? 'Muskan' : 'Vinay'}
              </div>
            </div>

            {/* Developer Corner (Vinay only) */}
            {user.role === 'V' && (
              <div className="relative">
                <button
                  ref={devBtnRef}
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 shadow-sm font-semibold transition-colors duration-200"
                >
                  <span>Settings</span>
                  <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {/* Settings Password Modal */}
                {showSettingsModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[6px]">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs border-2 border-purple-200">
                      <h3 className="text-lg font-bold text-purple-600 mb-2 text-center">Settings Access</h3>
                      <p className="text-sm text-gray-600 mb-4 text-center">Enter password to open settings:</p>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400 mb-2 text-center"
                        placeholder="Password"
                        value={settingsPassword}
                        onChange={e => setSettingsPassword(e.target.value)}
                        autoFocus
                      />
                      {settingsError && <div className="text-xs text-red-500 mb-2 text-center">{settingsError}</div>}
                      <div className="flex justify-center gap-3 mt-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white font-semibold hover:bg-purple-600 transition"
                          onClick={() => {
                            if (settingsPassword === 'request') {
                              setShowSettingsModal(false);
                              setSettingsPassword('');
                              setSettingsError('');
                              setDevOpen(true);
                            } else {
                              setSettingsError('Incorrect password!');
                            }
                          }}
                        >Open</button>
                        <button
                          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                          onClick={() => {
                            setShowSettingsModal(false);
                            setSettingsPassword('');
                            setSettingsError('');
                          }}
                        >Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
                {devOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg z-30 animate-fade-in">
                    <button
                      onClick={handleGetLocation}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm text-purple-800 font-medium border-b border-gray-100 last:border-b-0"
                    >
                      RT lcn
                    </button>
                    {/* Muskan's Location Display */}
                    <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 last:border-b-0">
                      <div className="font-semibold mb-1">M Lcn</div>
                      {loadingLocation ? (
                        <span className="inline-block align-middle min-w-[20px] min-h-[20px]" />
                      ) : locationError ? (
                        <span className="text-red-500">{locationError}</span>
                      ) : muskanLocation ? (
                        muskanLocation.error ? (
                          <span className="text-red-500">{muskanLocation.error}</span>
                        ) : (
                          <>
                            <div>Lat: {muskanLocation.lat}</div>
                            <div>Lng: {muskanLocation.lng}</div>
                            <div className="text-xs text-gray-400 mt-1">{muskanLocation.timestamp ? new Date(muskanLocation.timestamp).toLocaleString() : ''}</div>
                          </>
                        )
                      ) : (
                        <span className="text-gray-400">Not available</span>
                      )}
                    </div>
                    {/* Add more dev options here */}
                  </div>
                )}
              </div>
            )}

            {/* Watch Together Button */}
            <div className="flex-1 flex justify-center sm:justify-end items-center">
              <button
                onClick={() => navigate('/watch-together')}
                className="bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white font-bold py-2 px-5 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
              >
                <MdOndemandVideo size={22} /> Watch Together
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-40 flex flex-col space-y-4 animate-fade-in">
            {/* Both Users' Status */}
            <div className="flex items-center justify-center space-x-4 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
              {/* Muskan Status */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-700 mb-1">Muskan</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isMuskanOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className={`text-xs font-medium ${isMuskanOnline ? 'text-green-600' : 'text-gray-400'}`}>{isMuskanOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              {/* Vinay Status */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-700 mb-1">Vinay</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isVinayOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></div>
                  <span className={`text-xs font-medium ${isVinayOnline ? 'text-green-600' : 'text-gray-400'}`}>{isVinayOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>

            {/* Current User */}
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">
                {user.role === 'M' ? 'Muskan' : 'Vinay'}
              </div>
            </div>

            {/* Developer Corner (Vinay only) */}
            {user.role === 'V' && (
              <div className="relative">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 shadow-sm font-semibold transition-colors duration-200 w-full justify-center"
                >
                  <span>Settings</span>
                  <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {/* Settings Password Modal */}
                {showSettingsModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[6px]">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs border-2 border-purple-200">
                      <h3 className="text-lg font-bold text-purple-600 mb-2 text-center">Settings Access</h3>
                      <p className="text-sm text-gray-600 mb-4 text-center">Enter password to open settings:</p>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400 mb-2 text-center"
                        placeholder="Password"
                        value={settingsPassword}
                        onChange={e => setSettingsPassword(e.target.value)}
                        autoFocus
                      />
                      {settingsError && <div className="text-xs text-red-500 mb-2 text-center">{settingsError}</div>}
                      <div className="flex justify-center gap-3 mt-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white font-semibold hover:bg-purple-600 transition"
                          onClick={() => {
                            if (settingsPassword === 'request') {
                              setShowSettingsModal(false);
                              setSettingsPassword('');
                              setSettingsError('');
                              setDevOpen(true);
                            } else {
                              setSettingsError('Incorrect password!');
                            }
                          }}
                        >Open</button>
                        <button
                          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                          onClick={() => {
                            setShowSettingsModal(false);
                            setSettingsPassword('');
                            setSettingsError('');
                          }}
                        >Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
                {devOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded shadow-lg z-30 animate-fade-in">
                    <button
                      onClick={handleGetLocation}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 text-sm text-purple-800 font-medium border-b border-gray-100 last:border-b-0"
                    >
                      RT lcn
                    </button>
                    {/* Muskan's Location Display */}
                    <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 last:border-b-0">
                      <div className="font-semibold mb-1">M Lcn</div>
                      {loadingLocation ? (
                        <span className="inline-block align-middle min-w-[20px] min-h-[20px]" />
                      ) : locationError ? (
                        <span className="text-red-500">{locationError}</span>
                      ) : muskanLocation ? (
                        muskanLocation.error ? (
                          <span className="text-red-500">{muskanLocation.error}</span>
                        ) : (
                          <>
                            <div>Lat: {muskanLocation.lat}</div>
                            <div>Lng: {muskanLocation.lng}</div>
                            <div className="text-xs text-gray-400 mt-1">{muskanLocation.timestamp ? new Date(muskanLocation.timestamp).toLocaleString() : ''}</div>
                          </>
                        )
                      ) : (
                        <span className="text-gray-400">Not available</span>
                      )}
                    </div>
                    {/* Add more dev options here */}
                  </div>
                )}
              </div>
            )}

            {/* Watch Together Button */}
            <div className="flex-1 flex justify-center sm:justify-end items-center">
              <button
                onClick={() => navigate('/watch-together')}
                className="bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 text-white font-bold py-2 px-5 rounded-full shadow text-base transition-all duration-150 flex items-center gap-2"
              >
                <MdOndemandVideo size={22} /> Watch Together
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 w-full justify-center"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 