import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { checkPassword, savePassword, savedPassword } from '../ai/client';

/** 배포 때(VITE_REQUIRE_PASSWORD=1)만 처음 접속에 비밀번호를 묻는다. 비밀번호는 서버가 맞는지 확인하고, 이 탭에만 기억한다. */
export function PasswordGate({ children }: { children: ReactNode }) {
  const required = import.meta.env.VITE_REQUIRE_PASSWORD === '1';
  const [state, setState] = useState<'checking' | 'ask' | 'in'>(required ? 'checking' : 'in');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!required) return;
    const saved = savedPassword();
    if (!saved) return setState('ask');
    void checkPassword(saved).then((r) => (r === 'ok' ? setState('in') : setState('ask')));
  }, [required]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const r = await checkPassword(pw);
    if (r === 'ok') { savePassword(pw); setState('in'); }
    else setError(r === 'wrong' ? '비밀번호가 맞지 않습니다.' : '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도하세요.');
  }

  if (state === 'in') return <>{children}</>;
  if (state === 'checking') return <p className="muted">확인하는 중…</p>;
  return (
    <main className="start">
      <h1>내 손 안의 교육과정</h1>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label>접속 비밀번호
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={!pw}>들어가기</button>
      </form>
    </main>
  );
}
