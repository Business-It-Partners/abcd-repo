import { createContext, useContext } from 'react';
export const SessionGeneration = createContext(1);
export const useSessionGeneration = () => useContext(SessionGeneration);
