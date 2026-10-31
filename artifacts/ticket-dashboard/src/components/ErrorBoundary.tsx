import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);

    // If it's a hook-related error (common during HMR), auto-reload after a short delay
    const isHookError =
      error.message?.includes("hook") ||
      error.message?.includes("Hook") ||
      error.message?.includes("Hooks");

    if (isHookError) {
      this.reloadTimer = setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  componentWillUnmount() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isHookError =
        this.state.error?.message?.includes("hook") ||
        this.state.error?.message?.includes("Hook");

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            {isHookError ? (
              <>
                <h2 className="text-lg font-semibold text-foreground mb-2">Refreshing…</h2>
                <p className="text-muted-foreground text-sm">Detected a module update. Reloading automatically.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
                <p className="text-muted-foreground text-sm mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold shadow-md"
                >
                  Reload page
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
