import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}

/** 숫자 칸: 지우고 다시 쓸 수 있게 입력 중에는 글자를 그대로 두고, 범위 안의 값일 때만 반영한다. 칸을 벗어나면 범위로 맞춘다. */
export function NumField({ label, value, min, max, onChange }: Props) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  const commit = (t: string) => {
    const n = Number(t);
    if (t !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
  };
  return (
    <label>
      {label}
      <input
        type="number" min={min} max={max} value={shown}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        onBlur={() => setText(null)}
      />
    </label>
  );
}
