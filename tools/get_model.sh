#!/bin/sh
# 구글 공식 주소에서 자세 인식 모델(약 5.8MB)을 받아 vendor 폴더에 넣는다. 한 번만 하면 된다.
# 사용법: sh tools/get_model.sh
set -e
cd "$(dirname "$0")/.."
curl -fL -o vendor/mediapipe/pose_landmarker_lite.task \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
ls -l vendor/mediapipe/pose_landmarker_lite.task
