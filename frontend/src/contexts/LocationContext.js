import React, { createContext, useContext, useState } from 'react';

const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const [muskanLocation, setMuskanLocation] = useState(null);

  return (
    <LocationContext.Provider value={{ muskanLocation, setMuskanLocation }}>
      {children}
    </LocationContext.Provider>
  );
}; 