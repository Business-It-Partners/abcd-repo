import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { title: string; resetKey: string; children: ReactNode };
type State = { failed: boolean; resetKey: string };

/** Contains a React failure in one OS-managed app body without removing shell controls. */
export class WindowContentBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep diagnostic payloads free of component stacks and application data.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="window-content-recovery" role="alert">
      <h2>{this.props.title} is unavailable</h2>
      <p>The desktop is still running. Close and reopen this window, or retry its content.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>Retry content</button>
    </section>;
  }
}
