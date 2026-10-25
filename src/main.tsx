import React from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityGate } from './IdentityGate';
import { ShellErrorBoundary } from './ShellErrorBoundary';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ShellErrorBoundary><IdentityGate /></ShellErrorBoundary></React.StrictMode>);
