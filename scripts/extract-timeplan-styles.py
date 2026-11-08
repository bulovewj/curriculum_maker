# 시간 운영계획 hwpx((c))에서 칸 모양(스타일 번호·너비·병합)만 뽑아 src/export/hwpx/timePlanStyles.json 으로 저장한다.
# 사용: python3 scripts/extract-timeplan-styles.py "fixtures/2026-g6/원본/2026학년도 학년별 교육과정 시간 운영계획(6학년).hwpx"
# 글자 값은 머리·꼬리 줄 이름표(교과 이름, '1학기 계' 등)만 남기고 숫자 값은 버린다.
import json, re, sys, zipfile

x = zipfile.ZipFile(sys.argv[1]).read('Contents/section0.xml').decode()
x = re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', x)
tables = re.findall(r'<hp:tbl .*?</hp:tbl>', x, flags=re.S)

def cell(m, keep_text):
    a, b = m.group(1), m.group(2)
    sz = b[b.find('<hp:cellSz'):]
    g = lambda p, s=b: re.search(p, s).group(1)
    mg = re.search(r'cellMargin left="(\d+)" right="(\d+)" top="(\d+)" bottom="(\d+)"', b).groups()
    text = ''.join(re.findall(r'<hp:t>(.*?)</hp:t>', b)) if keep_text else ''
    text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    return dict(col=int(g(r'colAddr="(\d+)"')), colSpan=int(g(r'colSpan="(\d+)"')), rowSpan=int(g(r'rowSpan="(\d+)"')),
                width=int(g(r'width="(\d+)"', sz)), height=int(g(r'height="(\d+)"', sz)), borderFill=int(re.search(r'borderFillIDRef="(\d+)"', a).group(1)),
                header=int(re.search(r'header="(\d)"', a).group(1)) == 1, hasMargin=int(re.search(r'hasMargin="(\d)"', a).group(1)) == 1,
                paraPr=int(g(r'paraPrIDRef="(\d+)"')), charPr=int(g(r'charPrIDRef="(\d+)"')), wrap=g(r'lineWrap="(\w+)"'), margin=[int(v) for v in mg], text=text)

out = []
for t in tables:
    rows = [[cell(m, True) for m in re.finditer(r'<hp:tc ([^>]*)>(.*?)</hp:tc>', r, flags=re.S)] for r in re.findall(r'<hp:tr>(.*?)</hp:tr>', t, flags=re.S)]
    sz = re.search(r'<hp:sz width="(\d+)"', t).group(1)
    first_footer = next(i for i, r in enumerate(rows) if i >= 4 and re.search(r'계|편제|증감', r[0]['text']) and r[0]['colSpan'] == 3)
    data = []
    for r in rows[4:first_footer]:
        data.append([dict(c, text='') for c in r])
    out.append(dict(width=int(sz), head=rows[:4], first=data[0], mid=data[1], footers=[[dict(c) for c in r] for r in rows[first_footer:]]))
    for r in out[-1]['footers']:  # 숫자 값은 버리고 이름표(첫 칸)만 남긴다
        for i, c in enumerate(r):
            if i > 0: c['text'] = ''
json.dump(out, open('src/export/hwpx/timePlanStyles.json', 'w'), ensure_ascii=False, indent=0)
print('표', len(out), '머리 줄', [len(r) for r in out[0]['head']], '꼬리 줄', [r[0]['text'] for r in out[1]['footers']])
