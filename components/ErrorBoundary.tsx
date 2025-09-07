import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any) {
    console.error('ErrorBoundary caught:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-8 bg-red-900/20 border border-red-500 rounded-lg">
          <h3 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h3>
          <p className="text-red-300">Please refresh the page and try again.</p>
        </div>
      );
    }
    return this.props.children as any;
  }
}
