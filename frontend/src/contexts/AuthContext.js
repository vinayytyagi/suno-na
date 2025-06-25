import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie';
import { useLocation } from './LocationContext';

const AuthContext = createContext();

// Get API URL from environment variable
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to check if token is expired
const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

// Get token from storage (cookies first, then localStorage as fallback)
const getStoredToken = () => {
  const cookieToken = Cookies.get('token');
  const localToken = localStorage.getItem('token');
  
  // Prefer cookie token, fallback to localStorage
  return cookieToken || localToken;
};

// Set token in both storage methods
const setStoredToken = (token) => {
  Cookies.set('token', token, { expires: 7, secure: false, sameSite: 'lax' });
  localStorage.setItem('token', token);
};

// Clear all stored tokens
const clearAllTokens = () => {
  Cookies.remove('token');
  localStorage.removeItem('token');
  delete axios.defaults.headers.common['Authorization'];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { setMuskanLocation } = useLocation();

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = getStoredToken();
      console.log('Token on refresh:', token ? 'Found' : 'Not found');
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in axios headers immediately (ensure always set)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Optimistically set isAuthenticated to true if token exists and not expired
      if (!isTokenExpired(token)) {
        setIsAuthenticated(true);
      }

      // Check if token is expired
      if (isTokenExpired(token)) {
        console.log('Token expired, clearing...');
        clearAllTokens();
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      // Verify token with backend
      const response = await axios.get(`${API_URL}/api/auth/status`);
      console.log('Status API response:', response.status, response.data);
      
      setUser(response.data);
      setIsAuthenticated(true);
      
    } catch (error) {
      console.log('Status API error:', error?.response?.status, error?.response?.data);
      
      // If JWT signature is invalid or any auth error, clear all tokens
      if (error?.response?.status === 401 || 
          error?.response?.status === 403 || 
          error?.message?.includes('invalid signature')) {
        console.log('Auth error detected, clearing all tokens...');
        clearAllTokens();
      }
      
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (role, password) => {
    try {
      // Clear any existing tokens before login
      clearAllTokens();
      
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        role,
        password
      });

      const { token, user } = response.data;
      
      // Store token in both cookie and localStorage
      setStoredToken(token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      console.log('Login successful, token stored');
      setUser(user);
      setIsAuthenticated(true);

      // If Muskan logs in, fetch her location
      if (user.role === 'M' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: position.timestamp
            };
            try {
              await axios.post(`${API_URL}/api/auth/users/location`, loc, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setMuskanLocation(loc);
            } catch (err) {
              setMuskanLocation({ error: 'Failed to save location to server' });
            }
          },
          (error) => {
            setMuskanLocation({ error: error.message });
          }
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      const token = getStoredToken();
      if (token && !isTokenExpired(token)) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await axios.post(`${API_URL}/api/auth/logout`);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAllTokens();
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 