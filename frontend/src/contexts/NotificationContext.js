import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null);
  const [options, setOptions] = useState({});

  const notify = useCallback((message, opts = {}) => {
    setNotification(message);
    setOptions(opts);
    // Auto-hide after duration (default 2.2s)
    setTimeout(() => setNotification(null), opts.duration || 2200);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, notification, options }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
} 