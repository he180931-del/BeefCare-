"""Đối chiếu nhãn trường giữa code frontend và wireframe Figma cho từng màn SCR.

Nguồn:
  - docs/requirements/screens.yaml: mã SCR -> file code, frame wireframe.
  - docs/requirements/wireframe_texts.json: chữ trong từng frame wireframe (trang 01–11).
  - frontend/src/features: nhãn lấy từ label / header / *Label trong .tsx.

Dùng:
  python docs/tools/screen_audit.py SCR-39          # một màn
  python docs/tools/screen_audit.py FE-11           # theo feature
  python docs/tools/screen_audit.py --all > out.md  # toàn bộ
  python docs/tools/screen_audit.py --import-figma page07.xml
      # cập nhật cache từ kết quả get_metadata (XML) của một trang wireframe

Kết quả là gợi ý để rà: "+code" là nhãn có trong code mà wireframe không có,
"-wf" là chữ trên wireframe không còn thấy trong code (có thể là dữ liệu mẫu).
"""
import html, json, os, re, sys, unicodedata
import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FEAT = os.path.join(ROOT, 'frontend', 'src', 'features')
SCREENS = os.path.join(ROOT, 'docs', 'requirements', 'screens.yaml')
CACHE = os.path.join(ROOT, 'docs', 'requirements', 'wireframe_texts.json')

LABEL = re.compile(r"(?:label|header|Label)\s*[=:]\s*\{?\s*['\"`]([^'\"`\n{}$]{2,80})['\"`]")
STRING = re.compile(r"'([^'\n]{2,120})'|\"([^\"\n]{2,120})\"|`([^`\n]{2,120})`|>([^<>{}\n]{2,120})<")
IMPORT = re.compile(r"from\s+'(\.{1,2}/[^']+)'")


def norm(text):
    text = unicodedata.normalize('NFC', text).lower()
    text = re.sub(r'\(.*?\)', '', text).replace('*', '').replace('…', '')
    text = re.sub(r'[:?!.,←›‹▾✕☑☐+•]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def feature_of(path):
    rel = os.path.relpath(path, FEAT)
    return rel.split(os.sep)[0]


def source_files(paths, depth_limit=2):
    queue, depth = [], {}
    for rel in paths:
        full = os.path.join(FEAT, rel)
        if os.path.isdir(full):
            queue += [os.path.join(full, f) for f in os.listdir(full) if f.endswith('.tsx') and '.test.' not in f]
        elif os.path.exists(full):
            queue.append(full)
    for f in queue:
        depth[f] = 0
    seen = []
    while queue:
        f = queue.pop()
        if f in seen:
            continue
        seen.append(f)
        if depth[f] >= depth_limit:
            continue
        for m in IMPORT.finditer(open(f, encoding='utf-8').read()):
            base = os.path.normpath(os.path.join(os.path.dirname(f), m.group(1)))
            for cand in (base + '.tsx', os.path.join(base, 'index.tsx')):
                if os.path.exists(cand) and cand not in depth and feature_of(cand) == feature_of(f) and '/api/' not in cand:
                    depth[cand] = depth[f] + 1
                    queue.append(cand)
    return sorted(seen)


def code_corpus():
    words = set()
    for root, _, files in os.walk(FEAT):
        for name in files:
            if name.endswith(('.ts', '.tsx')) and '.test.' not in name:
                text = open(os.path.join(root, name), encoding='utf-8').read()
                for m in STRING.finditer(text):
                    words.add(norm(next(g for g in m.groups() if g)))
    return ' | '.join(words)


def code_labels(paths):
    labels = set()
    for f in source_files(paths):
        labels |= {m.group(1).strip() for m in LABEL.finditer(open(f, encoding='utf-8').read())}
    return {l for l in labels if re.search(r'[A-Za-zÀ-ỹ]{2}', l)}


def wf_labels(frames, cache):
    out = set()
    for fid in frames:
        for s in cache.get(fid, {}).get('texts', []):
            s = s.strip()
            if not s or len(s) > 45 or re.search(r'\d', s) or '·' in s or s in ('▾', '✕', '☰'):
                continue
            out.add(s)
    return out


def audit(scr, spec, cache, corpus):
    code = {norm(x): x for x in code_labels(spec['code']) if norm(x)}
    wf = {norm(x): x for x in wf_labels(spec['wf'], cache) if norm(x)}
    wf_all = ' | '.join(norm(t) for fid in spec['wf'] for t in cache.get(fid, {}).get('texts', []))
    plus_code = sorted(code[k] for k in code if k not in wf and k not in wf_all and len(k) > 2 and len(k) <= 40
                       and not re.match(r'(chọn|nhập|đang|chưa|không|tối đa|ví dụ)', k) and not code[k].endswith('.'))
    minus_wf = sorted(wf[k] for k in wf if k not in code and k not in corpus and len(wf[k].split()) <= 6)
    return plus_code, minus_wf


def import_figma(xml_path, cache):
    lines = open(xml_path, encoding='utf-8').read().split('\n')
    page = re.search(r'name="(\d\d)', lines[0]).group(1)
    section = None
    for i, line in enumerate(lines):
        indent = len(line) - len(line.lstrip())
        m = re.match(r'\s*<(section|frame) id="([^"]+)" name="([^"]*)"', line)
        if m and indent == 2 and m.group(1) == 'section':
            section = html.unescape(m.group(3))
        elif m and indent == 4 and m.group(1) == 'frame':
            texts = []
            for nxt in lines[i + 1:]:
                if len(nxt) - len(nxt.lstrip()) <= 4:
                    break
                t = re.match(r'\s*<text id="[^"]+" name="([^"]*)"', nxt)
                if t:
                    texts.append(html.unescape(t.group(1)))
            cache[m.group(2)] = {'page': page, 'section': section, 'name': html.unescape(m.group(3)), 'texts': texts}
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(f'Đã cập nhật trang {page}.')


def main(argv):
    cache = json.load(open(CACHE, encoding='utf-8'))
    if argv and argv[0] == '--import-figma':
        import_figma(argv[1], cache)
        return
    screens = yaml.safe_load(open(SCREENS, encoding='utf-8'))
    key = argv[0] if argv else '--all'
    chosen = {k: v for k, v in screens.items() if key == '--all' or k == key or v['fe'] == key}
    corpus = code_corpus()
    print('| SCR | Màn | Frame wireframe | +code (thiếu trên wireframe) | -wf (không còn trong code) |')
    print('|---|---|---|---|---|')
    for scr, spec in chosen.items():
        plus, minus = audit(scr, spec, cache, corpus)
        frames = len(spec['wf']) or 'chưa có'
        print(f"| {scr} | {spec['name']} | {frames} | {'; '.join(plus) or '—'} | {'; '.join(minus) or '—'} |")


if __name__ == '__main__':
    main(sys.argv[1:])
