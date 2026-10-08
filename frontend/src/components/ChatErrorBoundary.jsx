import { Component } from 'react';

export default class ChatErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Chat screen failed to render:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="auth-shell flex min-h-screen items-center justify-center px-4 py-8 text-white">
        <section role="alert" className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950/90 p-8 shadow-2xl">
          <p className="text-sm font-medium text-teal-200">CIPHERTRUST</p>
          <h1 className="mt-3 text-2xl font-semibold">The chat screen could not open.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            An unexpected display error occurred. Your account and saved encrypted conversations have not been deleted.
          </p>
          <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-gray-400">
            <summary className="cursor-pointer font-medium text-gray-300">Technical detail</summary>
            <p className="mt-2 break-words">{this.state.error.message || 'Unknown chat rendering error'}</p>
          </details>
          <button
            onClick={this.props.onReset}
            className="primary-button mt-6 w-full rounded-xl px-4 py-3 font-semibold text-gray-950"
          >
            Return to sign in
          </button>
        </section>
      </main>
    );
  }
}
