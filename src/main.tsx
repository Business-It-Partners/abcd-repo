import React from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityGate } from './IdentityGate';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><IdentityGate /></React.StrictMode>);
