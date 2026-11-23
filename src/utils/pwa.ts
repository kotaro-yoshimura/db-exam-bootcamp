// PWA（Service Worker 登録・オフラインキャッシュ監視・更新通知・インストール誘導）ユーティリティ
// data: URL や file:// ローカル単体HTML起動時はエラーを出さず安全にスキップする

export type SwLifecycleState =
  | 'unsupported'
  | 'skipped'
  | 'registering'
  | 'active'
  | 'update-available'
  | 'error';

export interface PwaStatus {
  /** ホーム画面アプリ（standalone）として起動しているか */
  isStandalone: boolean;
  /** Service Worker が動作可能なセキュア環境（HTTPS または localhost）か */
  isSecureOrigin: boolean;
  /** data: / file: / applewebdata: 等のローカル単体HTML起動か */
  isLocalSingleFile: boolean;
  /** Service Worker の現在状態 */
  swState: SwLifecycleState;
  /** オフラインキャッシュが存在するか */
  offlineCached: boolean;
  /** 現在のオンライン状態 */
  isOnline: boolean;
  /** Chrome / Edge 等のインストールプロンプトが利用可能か */
  canInstallPrompt: boolean;
  /** 補足メッセージ */
  detail: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = (status: PwaStatus) => void;

const listeners = new Set<Listener>();
let waitingWorker: ServiceWorker | null = null;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let reloadingForUpdate = false;

function detectStandalone(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const byMedia =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const byNavigator = Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    );
    return byMedia || byNavigator;
  } catch {
    return false;
  }
}

function detectProtocolInfo(): { isSecureOrigin: boolean; isLocalSingleFile: boolean } {
  try {
    if (typeof window === 'undefined' || !window.location) {
      return { isSecureOrigin: false, isLocalSingleFile: true };
    }
    const { protocol, hostname } = window.location;
    const isLocalSingleFile =
      protocol === 'data:' || protocol === 'file:' || protocol === 'applewebdata:';
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    const isSecureOrigin =
      protocol === 'https:' || (protocol === 'http:' && isLocalhost);
    return { isSecureOrigin, isLocalSingleFile };
  } catch {
    return { isSecureOrigin: false, isLocalSingleFile: true };
  }
}

const initialProto = detectProtocolInfo();

let currentStatus: PwaStatus = {
  isStandalone: detectStandalone(),
  isSecureOrigin: initialProto.isSecureOrigin,
  isLocalSingleFile: initialProto.isLocalSingleFile,
  swState: initialProto.isSecureOrigin ? 'registering' : 'skipped',
  offlineCached: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  canInstallPrompt: false,
  detail: initialProto.isLocalSingleFile
    ? 'ローカル単体HTML起動中（Service Workerは不要のため自動スキップ）'
    : initialProto.isSecureOrigin
      ? 'オフラインキャッシュを初期化中...'
      : 'HTTP配信のためService Worker無効（HTTPS配信で完全オフラインPWA化されます）',
};

function emitStatus(patch: Partial<PwaStatus>) {
  currentStatus = { ...currentStatus, ...patch };
  listeners.forEach((fn) => {
    try {
      fn(currentStatus);
    } catch {
      // リスナー側例外は無視
    }
  });
}

async function checkOfflineCacheReady(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('caches' in window)) return false;
    const keys = await window.caches.keys();
    return keys.some((k) => k.startsWith('db-exam-bootcamp-'));
  } catch {
    return false;
  }
}

export function getPwaStatus(): PwaStatus {
  return currentStatus;
}

export function subscribePwaStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * PWA Service Worker を安全な環境でのみ登録する
 */
export function registerPwaServiceWorker(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // オンライン / オフライン切替を監視
  window.addEventListener('online', () => emitStatus({ isOnline: true }));
  window.addEventListener('offline', () => emitStatus({ isOnline: false }));

  // Chrome / Edge 等のインストールプロンプトを捕捉
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    emitStatus({ canInstallPrompt: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    emitStatus({
      canInstallPrompt: false,
      isStandalone: true,
      detail: 'ホーム画面へのアプリインストールが完了しました',
    });
  });

  const { isSecureOrigin, isLocalSingleFile } = detectProtocolInfo();
  if (!isSecureOrigin) {
    emitStatus({
      swState: 'skipped',
      detail: isLocalSingleFile
        ? 'ローカル単体HTML起動中（HTTPS配信するとフルスクリーンPWA化できます）'
        : 'LAN HTTP接続中（HTTPS配信でオフラインキャッシュ・完全PWAが有効になります）',
    });
    return;
  }

  if (!('serviceWorker' in navigator)) {
    emitStatus({
      swState: 'unsupported',
      detail: 'このブラウザはService Workerに未対応です',
    });
    return;
  }

  // 新バージョンのService Workerへ切り替わったら1回だけ安全リロード
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  const doRegister = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      const markWaiting = (worker: ServiceWorker | null) => {
        if (!worker) return;
        waitingWorker = worker;
        emitStatus({
          swState: 'update-available',
          offlineCached: true,
          detail: '新しいバージョンが準備できました。更新ボタンで最新化できます。',
        });
      };

      if (reg.waiting && navigator.serviceWorker.controller) {
        markWaiting(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', async () => {
          if (installing.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              markWaiting(installing);
            } else {
              const cached = await checkOfflineCacheReady();
              emitStatus({
                swState: 'active',
                offlineCached: cached,
                detail: cached
                  ? 'オフライン動作の準備が完了しました（アプリ本体＋SQLite WASM保存済）'
                  : 'Service Worker が有効になりました',
              });
            }
          }
        });
      });

      const cached = await checkOfflineCacheReady();
      if (currentStatus.swState !== 'update-available') {
        emitStatus({
          swState: 'active',
          offlineCached: cached || Boolean(reg.active),
          detail:
            cached || reg.active
              ? 'オフライン動作の準備が完了しました（機内モードでも起動・SQL実行可能）'
              : 'オフラインキャッシュを作成しています...',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitStatus({
        swState: 'error',
        detail: `Service Worker登録エラー: ${msg}`,
      });
    }
  };

  if (document.readyState === 'complete') {
    void doRegister();
  } else {
    window.addEventListener('load', () => {
      void doRegister();
    });
  }
}

/**
 * 待機中の新バージョン Service Worker を即時適用する
 */
export function applyPwaUpdate(): void {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Chrome / Edge 等でネイティブのインストール確認ダイアログを開く
 */
export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredInstallPrompt = null;
      emitStatus({ canInstallPrompt: false });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
