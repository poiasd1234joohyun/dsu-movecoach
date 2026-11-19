# vendor 폴더 — 바깥에서 가져온 부품

심사장·강의실 와이파이에서 바깥 주소가 막혀도 돌아가도록, 실행 시점에 내려받던 파일을 프로젝트 안에 넣었습니다.

| 폴더·파일 | 무엇 | 어디서 | 라이선스 |
|---|---|---|---|
| `mediapipe/vision_bundle.mjs`, `mediapipe/wasm/*` | Google MediaPipe Tasks Vision 0.10.14 실행 파일 | npm 공식 꾸러미 `@mediapipe/tasks-vision@0.10.14` (shasum `16c5ddc513408f2a416ccc6ce8ccc797ee02da3b`) | Apache-2.0 |
| `mediapipe/pose_landmarker_lite.task` | 자세 인식 모델(관절 33개) | 구글 공식 주소(`tools/get_model.sh` 참고). **직접 받아 넣어야 하는 파일** | Apache-2.0 |
| `qrcodejs/qrcode.min.js` | QR 코드 그리기 (index.html 안에 합쳐짐) | github.com/davidshimjs/qrcodejs | MIT (`qrcodejs/LICENSE`) |

- 모델 파일이 없으면 프로그램이 구글 주소에서 직접 받습니다(인터넷 필요). 있으면 이 폴더의 파일만 씁니다.
- 어느 쪽을 쓰고 있는지는 프로그램의 "기기 점검" 화면(주소 끝에 `#check`)에서 볼 수 있습니다.
