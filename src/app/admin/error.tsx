'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin error boundary]', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard Variable", system-uI, sans-serif',
      background: '#FAFBFC',
    }}>
      <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px', color: '#E53935' }}>⚠️ 어드민 로딩 실패</h1>
        <p style={{ fontSize: 13, color: '#6B7684', margin: '0 0 16px', lineHeight: 1.5 }}>
          페이지 초기화 중 에러가 발생했어요. 아래 메시지를 그대로 복사해서 알려주세요.
        </p>

        <pre style={{
          background: '#F6F8FA',
          border: '1px solid #E1E4E8',
          borderRadius: 8,
          padding: 14,
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: 280,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#24292E',
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        }}>
{`메시지: ${error.message || '(none)'}

digest: ${error.digest || '(none)'}

스택:
${error.stack || '(no stack)'}`}
        </pre>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => reset()}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#3182F6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            다시 시도
          </button>
          <button onClick={() => {
            try { localStorage.clear(); sessionStorage.clear(); } catch {}
            location.reload();
          }}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #E1E4E8', background: '#fff', color: '#6B7684', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            스토리지 초기화 후 재로드
          </button>
        </div>
      </div>
    </div>
  );
}
