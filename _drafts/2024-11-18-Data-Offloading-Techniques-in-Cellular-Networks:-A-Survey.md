---
layout: post
title: Data Offloading Techniques in Cellular Networks - A Survey 
description: >
  **Date**: 2014.11.10, 
  **Tag**: [Mobile data offloading], [Hybrid networks], [Wifi], [Delay-tolerant networks], [Cellular networks]
image: 
  path: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
  srcset: 
    1920w: /assets/img/blog/dataoffloading-survey-1/Offloading.jpeg
    960w:  /assets/img/blog/dataoffloading-survey-1/Offloading@0,5x.jpeg
    480w:  /assets/img/blog/dataoffloading-survey-1/Offloading@0,25x.jpeg
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
hide_last_modified: true
---

<!--more-->
- Table of Contents
{:toc .large-only}

# 1. Why this paper
- Data offoading에 대한 이해

---

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