import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.authInfo && parsed.operationType) {
            isFirestoreError = true;
            errorMessage = `Database Error: ${parsed.error}. Operation: ${parsed.operationType} on ${parsed.path}`;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
          <div className="w-full max-w-md rounded-2xl bg-purple-950 p-8 shadow-2xl border border-purple-900/50">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 rounded-full bg-red-500/20 p-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold">Something went wrong</h2>
            </div>
            
            <div className="mb-8 rounded-xl bg-black/40 p-4 font-mono text-sm text-purple-200">
              {errorMessage}
            </div>

            <button
              onClick={this.handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 font-semibold text-white transition-all hover:bg-purple-500 active:scale-95"
            >
              <RefreshCw className="h-5 w-5" />
              Reset Application
            </button>
            
            {isFirestoreError && (
              <p className="mt-4 text-center text-xs text-purple-400">
                This looks like a database permission issue. Please contact support if it persists.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
