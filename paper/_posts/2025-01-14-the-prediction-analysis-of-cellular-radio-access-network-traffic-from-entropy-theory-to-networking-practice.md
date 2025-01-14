---
layout: post
title: The Prediction Analysis of Cellular Radio Access Network Traffic - From Entropy Theory to Networking Practice
description: >
  **Date**: 2014.06.14 <br>
  **Tag**: [Cellular networks], [Predictive models], [Telecommunication traffic], [Computer architecture], [Uncertainty], [Entropy], [Signal processing]
image: 
  path: /assets/img/blog/0114/thumbnail/thumbnail.png
  srcset: 
    1920w: /assets/img/blog/0114/thumbnail/thumbnail.png
    960w:  /assets/img/blog/0114/thumbnail/thumbnail@0,5x.png
    480w:  /assets/img/blog/0114/thumbnail/thumbnail@0,25x.png

excerpt_separator: <!--more-->
sitemap: false
hide_last_modified: true
---

<!--more-->
- Table of Contents
{:toc .large-only}

# 1. Why this paper

1. SKT 트래픽 예측 논문 레퍼런스 조사
2. 트래픽 시/공간 관계 조사

## 1.1 What is the research topic and why was it chosen?

- **연구 주제**: 셀룰러 RAN 트래픽 예측 가능성을 이론적으로 분석하고, 두를 활용한 네트워크 설계 방법 제안
- **선택 이유**:
  - 셀룰러 RAN 트래픽이 기존 음성 중심에서 데이터 중심으로 변화했기 때문
  - 셀룰러 RAN은 자원 제한, 사용자 이동성으로 인해 기존 연구를 그대로 적용하기 어려움
  - 에너지 효율적인 네트워크 설계와 효과적인 자원 관리를 위해 트래픽 예측의 필요성 대두

## 1.2 What are the objectives of the study?

- 엔트로피 이론을 활용해 셀룰러 RAN 트래픽의 시간적, 공간적, 서비스 간 예측 가능성을 분석
- 예측 결과를 바탕으로 에너지 효율적이고 트래픽 기반의 SD-RAN 설계
- 트래픽 예측을 통해 네트워크 자원을 효율적으로 관리하고 사용자 경험을 개선

## 1.3 What methods were used to conduct the research?
- 데이터셋: 차이나 모바일에서 7000개 기지국의 1개월간 트래픽 데이터 수집
- 분석 방법: 엔트로피 이론을 기반으로 데이터의 시간적, 공간적 특성을 정량화하여 불확실성을 분석
- 추가적 접근: 서비스 간 연관성과 시간, 공간적 정보의 조합이 트래픽 예측에 미치는 영향을 평가

## 1.4 What results were obtained?

- 엔트로피 분석 결과
  - 시간적 정보는 예측에 가장 큰 영향을 미치며, 과거 데이터가 많을수록 정확도가 향상
  - 공간적 정보는 추가적인 예측 개선을 지원하지만, 시간적 정보보다 덜 중요함
  - 음성 및 문자 서비스 간 상관관계는 높으나, 데이터 서비스는 상대적으로 독립적임

- 트래픽 기반 SD-RAN 설계
  - 제어 평면과 데이터 평면의 분리를 통해 네트워크 자원 관리의 유연성을 제공
  - 대규모 자원 관리와 소규모 플로우 중심 자원 할당 가능

## 1.5 What is the significance of the results?
- 셀룰러 RAN 트래픽은 시간적, 공간적, 서비스 간 연관성을 활용해 효과적으로 예측할 수 있음을 증명
- 트래픽 기반 예측은 에너지 효율적인 네트워크 설계 및 운영에 핵심 역할을 수행
- SD-RAN은 미래 네트워크 아키텍쳐의 중요한 방향성으로, 효율적인 자원 배분과 사용자 경험 향상을 가능하게 함

# 2. Paper Summarization

논문의 목표는 다음과 같다.

1. 엔트로피 이론을 활용하여 셀룰러 RAN 트래픽의 시간적, 공간적, 서비스 간 연관성을 분석한다.

### 3. Take Away


