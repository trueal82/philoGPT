import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Top-level React Error Boundary. Catches render errors anywhere in the tree
 * and shows a recovery modal instead of a white screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  private handleGoHome = () => {
    this.setState({ hasError: false });
    window.location.href = '/chat';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div
            className="modal-content modal-sm"
            role="alertdialog"
            aria-label="Error"
          >
            <div className="modal-header">
              <h2>Something went wrong</h2>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '1rem' }}>
                The page could not be loaded. This may happen if a conversation
                was deleted or the server is temporarily unavailable.
              </p>
              <button className="btn btn-primary" onClick={this.handleGoHome}>
                Go to start page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
