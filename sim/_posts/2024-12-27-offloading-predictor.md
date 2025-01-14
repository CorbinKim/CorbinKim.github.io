---
layout: post
title: 오프로딩 시뮬레이터 - Predictor 
description: >
  **Date**: 2024.12.27, 
  **Tag**: [Offloading], [Patent], [Multi Frequency Band]
image: 
  path: /assets/img/blog/sim/phase1/sim.png
  srcset: 
    1920w: /assets/img/blog/sim/phase1/sim.png
    960w:  /assets/img/blog/sim/phase1/sim@0,5x.png
    480w:  /assets/img/blog/sim/phase1/sim@0,25x.png
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
---

<!--more-->

* toc
{:toc .large-only}

# 5G 셀 시뮬레이터 구현 가이드: `traffic/collectors/predictor.py`

## 1. 아키텍쳐 개요

### 1.1 핵심 구조 
- 최상위 추상 클래스 (BasePredictor)
- 구체적인 구현 클래스들 (ArimaPredictor, ProphetPredictor 등)
- 모듈식 설계
    - 예측기 컴포넌트
    - 데이터 수집기 컴포넌트
    - 전처리기 컴포넌트
    - 정확도 검증 컴포넌트

### 1.2 주요 컴포넌트

1. BasePredictor: 모든 예측기의 기본이 되는 추상 클래스. 예측기가 구연해야 할 핵심 메서드들을 정의
2. ArimaPredictor: 시계열 데이터 분석에 널리 사용되는 ARIMA 모델을 구현한 예측기
3. ProphetPredictor: 시계열 데이터 분석에 널리 사용되는 Facebook Prophet 모델을 구현한 예측기
4. 추가 예정

### 1.3 데이터 흐름

1. 데이터 수집
- Cell 컴포넌트에서 트래픽 데이터 수집
- FrequencyCollector를 통한 주파수별 데이터 집계
  
2. 전처리
- DataPreprocessor를 통한 데이터 정규화
- 결측치 및 이상치 처리

3. 예측 수행
- 선택된 예측기를 통한 미래 트래픽 예측
- 예측 결과의 신뢰도 평가

4. 결과 활용
- RIC에서 예측 결과를 기반으로 자원 할당 최적화
- Cell에서 주파수 활성화/비활성호 결정

## 2. 코드 설명

### 2.1 BasePredictor(base_predictor.py)

``` python
class BasePredictor(ABC):
    """
    모든 예측기의 기본이 되는 추상 클래스
    새로운 예측 알고리즘을 추가할 때는 이 클래스를 상속받아 구현 예정
    
    주요 메서드:
    - train: 모델 학습
    - predict: 예측 수행
    - update: 모델 업데이트
    """
```

### 2.2 ARIMApredictor(arima_predictor.py)

``` python
class ArimaPredictor(BasePredictor):
    """
    ARIMA 모델을 활용한 예측기입니다.
    
    특징:
    - 단기 예측에 적합
    - 추세와 계절성을 고려한 예측 가능
    - 자기회귀 및 이동평균 특성 활용
    
    주의사항:
    - order 파라미터 설정이 중요 (p,d,q)
    - 데이터의 정상성 가정 필요
    """
```