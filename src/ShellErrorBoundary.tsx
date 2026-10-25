import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ShellErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(_error: Error) { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not persist renderer stacks or app data in platform diagnostics.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="shell-renderer-recovery" role="alert">
      <h1>Sajilo Dental is restoring the desktop</h1>
      <p>The platform session remains active. Reload the desktop to restore its controls and open app windows.</p>
      <button type="button" onClick={() => void window.desktop?.shell.reload()}>Reload desktop</button>
    </main>;
  }
}
