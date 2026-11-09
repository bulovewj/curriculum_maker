import { useState, type MouseEvent } from 'react';
import { LUNA, MODEL_PASSWORD, lunaOn, setLuna } from '../ai/client';

/** AI 도우미 옆 '모델 변경하기': 비밀번호를 넘으면 gpt-6-luna, 다시 누르면 기본 모델로 돌아간다. */
export function ModelSwitch() {
  const [on, setOn] = useState(lunaOn());
  const [asking, setAsking] = useState(false);
  const [pw, setPw] = useState('');
  const [bad, setBad] = useState(false);
  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); }; // 제목줄을 눌러 접히지 않게

  const toggle = (e: MouseEvent) => {
    stop(e);
    if (on) { setLuna(false); setOn(false); } else setAsking(!asking);
  };
  const submit = (e: MouseEvent) => {
    stop(e);
    if (pw === MODEL_PASSWORD) { setLuna(true); setOn(true); setAsking(false); setPw(''); setBad(false); } else setBad(true);
  };

  return (
    <span onClick={stop}>
      <button type="button" onClick={toggle}>{on ? `${LUNA} 사용 중 · 기본 모델로 되돌리기` : `모델 변경하기(${LUNA})`}</button>
      {asking && !on && (
        <>
          {' '}<input type="password" value={pw} placeholder="비밀번호" size={8} onChange={(e) => { setPw(e.target.value); setBad(false); }} onKeyDown={(e) => { e.stopPropagation(); }} />
          {' '}<button type="button" onClick={submit}>확인</button>
          {bad && <span className="warn"> 비밀번호가 맞지 않습니다</span>}
        </>
      )}
    </span>
  );
}
