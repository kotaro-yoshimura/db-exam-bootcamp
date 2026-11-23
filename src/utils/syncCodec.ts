// MacBook ⇔ iPhone/iPad ユニバーサルクリップボード3秒同期用 Base64圧縮コーデック
// オフライン・file://・全Safari/Chromeでゼロ依存かつ高速動作するようLZ辞書圧縮＋Base64を実装

import type { StudyState } from '../types/exam';

const SYNC_PREFIX = 'DBBC1:';

/**
 * シンプルかつ確実なLZ77ベースUTF-8バイト列圧縮（依存なし・同期実行）
 * 学習状態のJSON（反復キーが多い）を大幅に短縮する
 */
function compressBytes(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = input.length;
  const maxWindow = 255;
  const maxLen = 64;

  while (i < n) {
    let bestLen = 0;
    let bestDist = 0;
    const windowStart = Math.max(0, i - maxWindow);

    for (let j = windowStart; j < i; j++) {
      let len = 0;
      while (len < maxLen && i + len < n && input[j + len] === input[i + len]) {
        len++;
      }
      if (len >= 4 && len > bestLen) {
        bestLen = len;
        bestDist = i - j;
        if (len === maxLen) break;
      }
    }

    if (bestLen >= 4) {
      // マッチトークン: 0xFF, dist(1..255), len(4..64)
      out.push(0xff, bestDist, bestLen);
      i += bestLen;
    } else {
      const b = input[i];
      if (b === 0xff) {
        // エスケープリテラル: 0xFF, 0x00
        out.push(0xff, 0x00);
      } else {
        out.push(b);
      }
      i++;
    }
  }
  return new Uint8Array(out);
}

/**
 * compressBytes の逆変換
 */
function decompressBytes(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const b = input[i++];
    if (b === 0xff) {
      if (i >= n) throw new Error('圧縮データが途中で途切れています');
      const dist = input[i++];
      if (dist === 0) {
        out.push(0xff);
      } else {
        if (i >= n) throw new Error('圧縮データの長さ情報が不正です');
        const len = input[i++];
        const start = out.length - dist;
        if (start < 0) throw new Error('圧縮データの参照位置が不正です');
        for (let k = 0; k < len; k++) {
          out.push(out[start + k]);
        }
      }
    } else {
      out.push(b);
    }
  }
  return new Uint8Array(out);
}

/** URLセーフBase64エンコード */
function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** URLセーフBase64デコード */
function base64UrlToUint8(b64: string): Uint8Array {
  const clean = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  const binary = atob(clean + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 簡易FNV-1aチェックサム（改ざん・ペースト欠け検出） */
function computeChecksum(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) & 0xffff).toString(16).padStart(4, '0');
}

/**
 * StudyState を Base64圧縮同期コード（DBBC1:<checksum>:<payload>）へ変換
 */
export function encodeSyncCode(state: StudyState): string {
  const json = JSON.stringify(state);
  const rawBytes = new TextEncoder().encode(json);
  const compressed = compressBytes(rawBytes);
  // 圧縮後の方が小さければ圧縮版(c)、そうでなければ非圧縮(r)
  const useCompressed = compressed.length < rawBytes.length;
  const payloadBytes = useCompressed ? compressed : rawBytes;
  const flag = useCompressed ? 'c' : 'r';
  const checksum = computeChecksum(rawBytes);
  return `${SYNC_PREFIX}${flag}${checksum}:${uint8ToBase64Url(payloadBytes)}`;
}

/**
 * Base64圧縮同期コードから StudyState を復元・検証する
 */
export function decodeSyncCode(code: string): StudyState {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SYNC_PREFIX)) {
    // 生JSONペーストも親切に受け付ける
    if (trimmed.startsWith('{')) {
      return validateStudyState(JSON.parse(trimmed));
    }
    throw new Error('同期コードの形式が正しくありません（DBBC1: で始まるコードを貼り付けてください）');
  }

  const body = trimmed.slice(SYNC_PREFIX.length);
  const colonIdx = body.indexOf(':');
  if (colonIdx < 5) {
    throw new Error('同期コードのヘッダが破損しています');
  }

  const meta = body.slice(0, colonIdx);
  const flag = meta[0];
  const expectedChecksum = meta.slice(1);
  const payloadB64 = body.slice(colonIdx + 1);

  const payloadBytes = base64UrlToUint8(payloadB64);
  const rawBytes = flag === 'c' ? decompressBytes(payloadBytes) : payloadBytes;
  const actualChecksum = computeChecksum(rawBytes);

  if (actualChecksum !== expectedChecksum) {
    throw new Error('チェックサム不一致：同期コードが途中で欠けている可能性があります');
  }

  const jsonStr = new TextDecoder().decode(rawBytes);
  return validateStudyState(JSON.parse(jsonStr));
}

/**
 * 復元データの妥当性検証と正規化
 */
export function validateStudyState(raw: unknown): StudyState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('学習データの形式が不正です');
  }
  const obj = raw as Partial<StudyState>;
  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    completedRoadmapTasks: Array.isArray(obj.completedRoadmapTasks)
      ? obj.completedRoadmapTasks.filter((x): x is string => typeof x === 'string')
      : [],
    solvedSqlDrills: Array.isArray(obj.solvedSqlDrills)
      ? obj.solvedSqlDrills.filter((x): x is string => typeof x === 'string')
      : [],
    solvedSchemaQuizzes: Array.isArray(obj.solvedSchemaQuizzes)
      ? obj.solvedSchemaQuizzes.filter((x): x is string => typeof x === 'string')
      : [],
    cbtDrafts: obj.cbtDrafts && typeof obj.cbtDrafts === 'object' ? obj.cbtDrafts : {},
    reviewQueue: Array.isArray(obj.reviewQueue) ? obj.reviewQueue : [],
    flashcardStatus:
      obj.flashcardStatus && typeof obj.flashcardStatus === 'object' ? obj.flashcardStatus : {},
    totalAttempts: typeof obj.totalAttempts === 'number' ? obj.totalAttempts : 0,
    lastModule:
      obj.lastModule === 'home' ||
      obj.lastModule === 'lab' ||
      obj.lastModule === 'sql' ||
      obj.lastModule === 'cbt' ||
      obj.lastModule === 'review' ||
      obj.lastModule === 'roadmap'
        ? obj.lastModule
        : 'home',
  };
}

/**
 * file:// 環境やiOS Safariでも確実に動くクリップボードコピー関数
 */
export async function copyTextReliable(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // file:// 等でPermissionエラーが出たらフォールバックへ進む
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
