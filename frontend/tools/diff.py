#!/usr/bin/env python3
"""So sánh ảnh app với ảnh Figma.
Dùng: python3 tools/diff.py <figma.png> <app.png> <out_prefix> [x,y,w,h]
In ra: kích thước, % điểm ảnh khác (ngưỡng 24), và 6 vùng lệch nhiều nhất (x,y,w,h).
Ghi <out_prefix>-side.png (Figma | App | Diff) để xem bằng mắt."""
import sys
from PIL import Image, ImageChops
import numpy as np

fig, app, prefix = sys.argv[1:4]
crop = sys.argv[4] if len(sys.argv) > 4 else None  # "x,y,w,h": chỉ xuất ảnh phóng to 2x của vùng này (Figma | App)
a = Image.open(fig).convert('RGB')
b = Image.open(app).convert('RGB')
if crop:
    x, y, w, h = [int(v) for v in crop.split(',')]
    ca_, cb_ = a.crop((x, y, x + w, y + h)).resize((w * 2, h * 2)), b.crop((x, y, x + w, y + h)).resize((w * 2, h * 2))
    out = Image.new('RGB', (w * 4 + 10, h * 2), (255, 0, 255)); out.paste(ca_, (0, 0)); out.paste(cb_, (w * 2 + 10, 0))
    out.save(f'{prefix}-crop.png'); print(f'{prefix}-crop.png (trái=Figma, phải=App, phóng 2x)'); sys.exit(0)
W, H = max(a.width, b.width), max(a.height, b.height)
ca = Image.new('RGB', (W, H), (255, 0, 255)); ca.paste(a, (0, 0))
cb = Image.new('RGB', (W, H), (255, 0, 255)); cb.paste(b, (0, 0))
d = np.abs(np.asarray(ca).astype(int) - np.asarray(cb).astype(int)).max(axis=2)
mask = d > 24
pct = mask.mean() * 100
print(f'figma={a.size} app={b.size} diff={pct:.2f}%')
if a.size != b.size:
    print(f'!! KÍCH THƯỚC KHÁC: figma {a.size} vs app {b.size}')
# lưới 48px -> vùng lệch nhiều nhất
G = 48
cells = []
for y in range(0, H, G):
    for x in range(0, W, G):
        c = mask[y:y+G, x:x+G].mean()
        if c > 0.04: cells.append((c, x, y))
cells.sort(reverse=True)
print('vùng lệch nhiều nhất (x,y, tỉ lệ):', [(x, y, round(c, 2)) for c, x, y in cells[:8]])
heat = np.asarray(cb).copy()
heat[mask] = [255, 0, 0]
side = Image.new('RGB', (W * 3 + 20, H), (255, 255, 255))
side.paste(ca, (0, 0)); side.paste(cb, (W + 10, 0)); side.paste(Image.fromarray(heat), (2 * W + 20, 0))
side.save(f'{prefix}-side.png')
print(f'{prefix}-side.png')
