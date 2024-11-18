---
layout: post
title: AI-Ready Energy Modelling for Next Generation RAN
description: >
  **Date**: 2024.11.04, 
  **Tag**: [AIMM], [System Level Simulator]
image: 
  path: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
  srcset: 
    1920w: /assets/img/blog/aimm/AIMM.jpg
    960w:  /assets/img/blog/aimm/AIMM@0,5.jpg/
    480w:  /assets/img/blog/aimm/AIMM@0,25x.jpg
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
hide_last_modified: true
---

<!--more-->
- Table of Contents
{:toc .large-only}

# 1. Why this paper

1. AIMM 시뮬레이터 이해
2. 기지국 환경에서 사용할 수 있는 파라미터들 숙지

# 2. Paper Summarization

## 2.1 Introduction

### 2.1.1 문제 정의
차세대 RAN 설계에서는 에너지 소비가 중요한 설계 기준이 되었으며 AI와 ML을 활용하여 네트워크 에너지 효율성과 성능 간의 트레이드오프를 최적화하려는 연구가 진행되고 있다.

### 2.1.2 AIMM 시뮬레이터
AIMM(AI-enabled Massive MIMO) 시뮬레이터는 5G 네트워크를 가상으로 재현하며, 송신 전력 감소 시나리오를 통해 에너지 효율성(EE)과 스펙트럼 효율성(SE)를 분석할 수 있는 오픈소스 시뮬레이터이다.

### 2.1.3 핵심 목표
1. 송신 전력 조정을 통해 EE와 SE간의 관계를 파악
2. 네트워크 성능을 저하하지 않으면서 에너지 소비를 최적화


## 2.2 Backgroud

### 2.2.1 5G 네트워크의 에너지 소비 문제
- 기지국(Base Station, BS)이 전체 에너지 소비의 70%를 차지하며 지속적으로 증가할 전망이다.
  - 주요 원인: Massive MIMO와 같은 기술은 데이터 처리량을 증가시키지만, 더 많은 전력을 요구
  - 기존 최적화 방법: Sleep mode, Lean Carrier Design, ML 기반 에너지 모델링 등
  
### 2.2.2 디지털트윈과 AIMM 시뮬레이터
- 디지털 트윈은 실제 네트워크를 복제한 가상 환경으로, AI/ML 모델을 안전하게 학습하고 테스트할 수 있게 한다.

- AIMM 시뮬레이터의 강원
  - 기지국과 사용자 장치 간의 상호작용을 정밀히 재현
  - 빠른 실행 속도(평균 2초 실행 시간)로 ML 모델 훈련과 테스트 지원   

## 2.3 Methods

### 2.3.1 AIMM 시뮬레이터 구성
- 시뮬레이터의 특징
  - 3D 모델링: 기지국과 UE를 공간적으로 배치하고, Pathloss를 계산
  - SINR 및 CQI 계산: 신호 품질을 정밀히 추정하여 사용자 데이터 전송 품질 분석
  - Spectral Efficiency(SE) 및 처리량($$T_{i,j}$$) 계산

- 주요 수식
  
**SINR 계산** 
    

$$SINR_{i,j} = \frac{P_{Rx,i,j}}{P_{inter,i} + P_{noise,i}}$$

$$P_{R_{x_{i,j}}}$$: 사용자 $$i$$가 기지국 $$j$$로부터 받은 신호 전력

$$P_{inter_{i}}$$: 사용자 $$i$$가 경험하는 간섭 전력

$$P_{noise_{i}}$$: 사용자 $$i$$가 경험하는 잡음 전력


**Throughput 계산**

$$
T_{i,j} = SE_{i,j} \times B
$$

$$SE_{i,j}$$: 사용자와 기지국 간의 Spectral Efficiency

$$B$$: 사용 가능한 대역폭(논문에서는 10MHz 사용)


### 2.3.2 기지국 전력 소비 모델

- AIMM 시뮬레이터는 기존 전력 소비 모델을 확장하여 기지국의 에너지 소비를 정밀히 계산한다.

**전력 소비 수식**

$$
P_{BS} = N_{TRX} \times N_{ant} \times (P_0 + f(P_{T_{x}}))
$$

$$P_{BS}$$: 기지국의 총 전력 소비량($$W$$)

$$f(P_{T_{x}})$$: 송신 전력에 따른 동적 전력 소비


 **송신 전력 소비 함수**

$$
f(P_{Tx}) = \frac{P_{Tx}}{\eta P_{PA} \cdot (1 - \sigma_{feed})} + P_{RF} + P_{BB}
$$

$$\eta_{PA}$$: 전력 증폭기 효율(논문에서는 0.311 사용)

$$\sigma_{feed}$$: Feeder loss, 송신신호가 기지국 안테나로 전달되는 동안 발생하는 전력 손실(논문에서는 0.5 사용)

$$P_{RF}$$: RF 처리 전력, RF 신호를 처리학 위해 필요한 전력(논문에서는 12.9W 사용)

$$P_{BB}$$: 베이스밴드 처리 전력(논문에서는 29.6W 사용)


### 2.3.3 실험 설정
- 시나리오 구성
  - 19개의 기지국을 기반으로 아래의 그림과 같이 네 가지 주요 시나리오를 설정하였다.
  - 송신 전력을 0 - 20W로 조정하여 에너지 소비와 네트워크 성능을 분석하였다.

<p align="center">
  <img src="/assets/img/blog/aimm/network-topology.png" alt="Topology of this paper" width="50%">
  <img src="/assets/img/blog/aimm/scenario-table.png" alt="BS Scenario Definitions" width="40%">
</p>


## 2.4 Results and Discussion

![Result](/assets/img/blog/aimm/graph.png)

### 2.4.1 송신 전력과 네트워크 성능

- 송신 전력 감소는 간섭을 줄여 SINR을 향상시킬 수 있으며, 일부 시나리오에서 네트워크 throughput이 증가하였다.
  - 간섭 감소로 인해 네트워크 성능이 특정 송신 전력에서 최적화되는 결과를 확인할 수 있었다.

### 2.4.2 에너지 효율성(EE)

- 에너지 효율성 계산:

$$
EE = \frac{T_s \cdot \tau}{P_{Cs}}
$$

$$T_s$$: 네트워크의 총 처리량

$$PC_{s}$$: 네트워크 평균 전력 소비

송신 전력 조정 및 기지국 sleep 모드를 통해 EE가 최대 14.8% 향상
{:.note}

### 2.4.3 스펙트럼 효율성(SE)됨

송신 전력 감소 초기에는 SE가 증가하지만, 송신 전력이 너무 낮아지면 데이터 전송량 감소로 인해 SE가 감소
{:.note}

- 최적의 송신 전력 설정이 필요


### 2.4.4 미래 네트워크 설계 시 주의할 점

- EE와 SE 간 트레이드오프를 고려한 최적화 전략이 중요
- AIMM 시뮬레이터는 디지털 트윈 환경에서 빠르고 정밀한 실험을 지원하며, 차세대 네트워크 설계에 중요한 도구로 평가됨

## 2.5 Conclusion

- AIMM 시뮬레이터는 에너지 소비와 성능 간 trade-off를 분석하고 최적화를 지원하는 강력한 시뮬레이터임
- 디지털 트윈 환경에서 AI 및 ML 모델의 학습과 테스트를 안전하고 효율적으로 수행할 수 있음
- 본 논문에서는 에너지 소비와 성능을 동시에 고려한 차세대 네트워크 설계의 중요성을 강조

---

# 3. Take Away

- AIMM 시뮬레이터 구현 파라미터 현황
- 본 논문에서 임의로 정한 파라미터들(예. $$\sigma_{feed}$$ 등)을 고려하여 후속 연구 진행 