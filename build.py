#!/usr/bin/env python3
"""DSU 무브코치 빌드: src/ 조각들을 합쳐 index.html 한 파일을 만든다.
사용법: python3 build.py   (이 파일이 있는 폴더 기준, 어디서 실행해도 됨)
결과물: index.html (배포용), build/main.mjs (문법 검사용: node --check build/main.mjs)
올릴 때 필요한 것: index.html + vendor/ 폴더(자세 인식 파일) + media/ 폴더(샘플 영상, 있으면)
"""
import re, urllib.parse, os
ROOT = os.path.dirname(os.path.abspath(__file__))
def rd(*p): return open(os.path.join(ROOT, *p), encoding='utf-8').read()

src = rd('src', 'v4_head.html')
eng = rd('src', 'engine.mjs')
def strip_module(code):  # 한 파일로 합치므로 export/import 문을 걷어낸다
    code = re.sub(r'^export (const|function|class) ', r'\1 ', code, flags=re.M)
    return re.sub(r'^import [^\n]*?;[ \t]*$', '', code, flags=re.M)
eng = strip_module(eng)
syn = strip_module(rd('src', 'synth.mjs'))
qr = rd('vendor', 'qrcodejs', 'qrcode.min.js').strip()
assert '</script' not in qr.lower()
# 순서 주의: v4_app2.js 가 맨 끝에서 화면을 처음 그리므로 나머지는 모두 그 앞에 와야 한다. v5_visual.js(그림)는 v4_app1.js(SCENES 사용)보다 앞.
app = '\n'.join(rd('src', f) for f in ['v4_core.js', 'v5_visual.js', 'v5_match.js', 'v4_app1.js', 'v4_try.js', 'v4_app2.js'])
i192 = rd('assets', 'icon192.b64').strip(); i512 = rd('assets', 'icon512.b64').strip()
dsu = rd('assets', 'dsu_logo.b64').strip(); ui = rd('assets', 'ui_logo.b64').strip()
manifest = '{"name":"DSU 무브코치","short_name":"무브코치","start_url":".","display":"standalone","background_color":"#ffffff","theme_color":"#e01838","icons":[{"src":"data:image/png;base64,%s","sizes":"192x192","type":"image/png"},{"src":"data:image/png;base64,%s","sizes":"512x512","type":"image/png"}]}' % (i192, i512)
link = '<link rel="manifest" href="data:application/manifest+json,%s">' % urllib.parse.quote(manifest, safe="")
out = (src.replace('__ENGINE__', eng).replace('__SYNTH__', syn).replace('__QRCODE__', qr).replace('__APP__', app).replace('__ICON192__', i192)
          .replace('__DSULOGO__', dsu).replace('__UILOGO__', ui)
          .replace('<meta name="theme-color" content="#e01838">', '<meta name="theme-color" content="#e01838">\n' + link))
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
open(os.path.join(ROOT, 'build', 'main.mjs'), 'w', encoding='utf-8').write(
    re.search(r'<script type="module">(.*?)</script>', out, re.S).group(1))
print('index.html bytes', len(out.encode()))
