import { useState, type MouseEvent } from 'react';
import { LUNA, checkModelPassword, lunaOn, setLuna } from '../ai/client';

/** AI 도우미 옆 '모델 변경하기': 비밀번호를 넘으면 gpt-6-luna, 다시 누르면 기본 모델로 돌아간다. */
export function ModelSwitch() {
  const [on, setOn] = useState(lunaOn());
  const [asking, setAsking] = useState(false);
  const [pw, setPw] = useState('');
  const [bad, setBad] = useState('');
  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); }; // 제목줄을 눌러 접히지 않게

  const toggle = (e: MouseEvent) => {
    stop(e);
    if (on) { setLuna(''); setOn(false); } else setAsking(!asking);
  };
  const submit = async (e: MouseEvent) => {
    stop(e);
    const r = await checkModelPassword(pw); // 비밀번호는 서버만 안다
    if (r === 'ok') { setLuna(pw); setOn(true); setAsking(false); setPw(''); setBad(''); }
    else setBad(r === 'down' ? ' 서버에 연결하지 못했습니다' : ' 비밀번호가 맞지 않습니다');
  };

  return (
    <span onClick={stop}>
      <button type="button" onClick={toggle}>{on ? `${LUNA} 사용 중 · 기본 모델로 되돌리기` : `모델 변경하기(${LUNA})`}</button>
      {asking && !on && (
        <>
          {' '}<input type="password" value={pw} placeholder="비밀번호" size={8} onChange={(e) => { setPw(e.target.value); setBad(''); }} onKeyDown={(e) => { e.stopPropagation(); }} />
          {' '}<button type="button" onClick={submit}>확인</button>
          {bad && <span className="warn">{bad}</span>}
        </>
      )}
    </span>
  );
}
