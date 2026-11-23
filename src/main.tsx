import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerPwaServiceWorker } from './utils/pwa';

// Reactエラーバウンダリ（描画エラー時のみ安全に表示し、無関係なScript errorで画面を壊さない）
class AppErrorBoundary extends React.Component<
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

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-4 text-xs font-mono text-[#9f1239] whitespace-pre-wrap">
          <div className="font-bold text-sm mb-2">表示エラーが発生しました</div>
          <div>{this.state.error.message}</div>
          {this.state.error.stack && <div className="mt-2 opacity-80">{this.state.error.stack}</div>}
        </div>
      );
    }
    return this.props.children;
  }
}

function showNonDestructiveBanner(title: string, detail: string) {
  try {
    const id = 'db-bootcamp-err-banner';
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText =
        'position:fixed;top:8px;left:8px;right:8px;z-index:9999;padding:12px;background:#4c0519;color:#fecdd3;border:1px solid #fb7185;border-radius:10px;font-family:monospace;font-size:11px;white-space:pre-wrap;max-height:40vh;overflow:auto;';
      document.body.appendChild(el);
    }
    el.textContent = `${title}\n${detail}`;
  } catch {
    // 無視
  }
}

function mountApp() {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;

    const root = ReactDOM.createRoot(rootEl, {
      onUncaughtError(error) {
        const msg = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
        showNonDestructiveBanner('未捕捉Reactエラー:', msg);
      },
      onCaughtError(error) {
        // ErrorBoundaryで捕捉済み
        void error;
      },
    });

    root.render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );

    // HTTPS / localhost 環境でのみオフラインPWA用 Service Worker を安全に登録
    registerPwaServiceWorker();
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    showNonDestructiveBanner('起動時エラー:', msg);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
