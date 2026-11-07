"""2026 2학기 국어 진도를 NEIS 출력 PDF에서 한 번만 뽑는 개발용 스크립트.

왜 필요한가: 학교 진도표 (e)의 국어 표는 103행이 자리표시자라 실제 내용이 PDF에만 있다.
앱은 PDF를 받지 않는다. 이 스크립트는 앱에 포함되지 않고 fixtures 자료만 만든다.

실행: pip install pdfplumber openpyxl 후 프로젝트 폴더에서
      python scripts/extract-ko-s2-pdf.py
결과: fixtures/2026-g6/추출/2학기_국어_PDF추출.json (주·날짜·성취기준·비고 포함)
      fixtures/2026-g6/추출/6학년_2학기_국어_진도표.xlsx (NEIS형, 앱에 넣을 수 있음)
"""
import collections
import json
import os
import re
import unicodedata

import openpyxl
import pdfplumber

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT_DIR = os.path.join(ROOT, 'fixtures', '2026-g6', '추출')
NEIS_HEADER = ['순번', '*학년', '*학기', '*편제', '단원', '학습내용', '쪽수', '보조쪽수', '해당차시', '전체차시', '준비물']
EXPECTED_ROWS = 109  # PDF 끝줄 '2학기 총 시수: 109시간'


def nfc(text):
    return unicodedata.normalize('NFC', text)


def find_entry(folder, prefix):
    """맥 파일 이름은 자모 분리형일 수 있어 NFC로 비교한다."""
    return next(n for n in os.listdir(folder) if nfc(n).startswith(prefix))


def pdf_path():
    reference = os.path.join(ROOT, 'reference')
    folder = os.path.join(reference, find_entry(reference, '6학년 2학기'))
    return os.path.join(folder, find_entry(folder, '국어'))


def cell_text(page, box):
    """칸 안 글자를 줄 순서대로 잇는다. 줄 끝 공백이 PDF에 남아 있어 띄어쓰기가 보존된다."""
    x0, top, x1, bottom = box
    lines = collections.defaultdict(list)
    for c in page.chars:
        if x0 <= (c['x0'] + c['x1']) / 2 <= x1 and top <= (c['top'] + c['bottom']) / 2 <= bottom:
            lines[round(c['top'])].append(c)
    merged = []
    for key in sorted(lines):
        if merged and key - merged[-1][0] <= 3:
            merged[-1][1].extend(lines[key])
        else:
            merged.append([key, list(lines[key])])
    return ''.join(''.join(c['text'] for c in sorted(chars, key=lambda c: c['x0'])) for _, chars in merged)


def read_cells(path):
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for row in page.find_table().rows:
                yield [cell_text(page, box) if box else None for box in row.cells]


def to_rows(cells):
    rows = []
    week = date = unit = standards = None
    for v in cells:
        if v[0] == '주' or (v[0] or '').startswith('▶'):
            continue
        lesson = re.fullmatch(r'(\d+)/(\d+)', (v[5] or '').strip())
        if not lesson:  # 쪽 경계에서 잘린 행: 앞 행에 이어 붙인다
            rows[-1]['topic'] = (rows[-1]['topic'] + ' ' + (v[4] or '')).strip()
            standards = (standards or '') + (v[3] or '')
            continue
        week = int(v[0]) if v[0] else week
        date = v[1] or date
        unit = (v[2] or unit).strip()
        standards = v[3] or standards
        rows.append({
            'week': week, 'date': date, 'unit': unit,
            'standards': sorted(set(re.findall(r'\[\d[가-힣]+\d+-\d+\]', standards or ''))),
            'topic': (v[4] or '').strip(), 'n': int(lesson[1]), 'total': int(lesson[2]),
            'pages': (v[6] or '').strip(), 'note': (v[7] or '').strip(),
        })
    return rows


def validate(rows):
    if len(rows) != EXPECTED_ROWS:
        raise SystemExit(f'행 수 {len(rows)} != {EXPECTED_ROWS}')
    for unit in dict.fromkeys(r['unit'] for r in rows):
        lessons = [r for r in rows if r['unit'] == unit]
        if [r['n'] for r in lessons] != list(range(1, len(lessons) + 1)):
            raise SystemExit(f'차시 순서 오류: {unit}')
        if {r['total'] for r in lessons} != {len(lessons)}:
            raise SystemExit(f'전체 차시 오류: {unit}')


def write_xlsx(rows, path):
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = 'empty0'
    sheet.append(NEIS_HEADER)
    for i, r in enumerate(rows, 1):
        sheet.append([str(i), '6', '2', '국어', r['unit'], r['topic'], r['pages'] or None,
                      None, str(r['n']), str(r['total']), None])
    book.save(path)


def main():
    rows = to_rows(read_cells(pdf_path()))
    validate(rows)
    os.makedirs(OUT_DIR, exist_ok=True)
    payload = {'source': '6학년 2학기 진도표 pdf/국어_연간지도계획.pdf (2026-09-03 생성)', 'rows': rows}
    with open(os.path.join(OUT_DIR, '2학기_국어_PDF추출.json'), 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    write_xlsx(rows, os.path.join(OUT_DIR, '6학년_2학기_국어_진도표.xlsx'))
    print(f'{len(rows)}행 저장: {OUT_DIR}')


if __name__ == '__main__':
    main()
