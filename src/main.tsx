import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CipherID Runtime Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-[#EF4444]/40 p-6 space-y-4 text-center">
            <div className="text-base font-bold text-white">
              Something went wrong rendering this view
            </div>
            <p className="text-xs font-mono text-[#EF4444] break-words bg-[#161926] p-3 rounded-xl border border-white/10">
              {this.state.error.message || 'Unexpected rendering error'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] text-xs font-semibold"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

