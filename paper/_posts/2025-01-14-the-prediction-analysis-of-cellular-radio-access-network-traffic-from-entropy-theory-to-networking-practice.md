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

# 논문 개요 분석

## Introduction

- 본 논문의 연구 배경과 연구 필요성 언급
- 기존 연구의 한계점 지적 및 본 논문의 목표와 연구 범위 제시

## Traffic Prediction: Theoretical ANalysis and Practical Performance
  
### Prediction Dataset Description and Analysis Methodology
  - 데이터 수집 과정 및 분석 방법론 
  - 데이터 전처리 및 트래픽 엔트로피 계산
  
### Prediction Analysis: To What Extent Is the Prior Information Required?
  - 트래픽 예측에 필요한 사전 정보의 범위를 논의
  - 시간적, 공간적, 서비스 간 상호작용을 통한 예측 가능성 분석

### Prediction Performance: The Current State of Research
  - 트래픽 예측 성능을 평가하고, 현재 연구 방법론의 한계를 제시

## Traffic Prediction and Future Network Architecture: Directions and Applications

### Brief Description of the Traffic-Based SDRAN Architecture
- SDRAN 구조 소개

### Large-Scale Traffic-Aware Resource Management
- 대규모 트래픽 예측 기반 자원 관리 기법 논의

### Small-Scale Flow-Centric Resource Allocation
- 세부 흐름 중심의 자원 할당 방안을 설명

## Conclusion
- 논문의 주요 결론과 향후 연구 방향 제시
  
---

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

---

# 2. Paper Summarization

논문의 목표는 다음과 같음

1. 엔트로피 이론을 활용하여 셀룰러 RAN 트래픽의 시간적, 공간적, 서비스 간 연관성을 분석
2. 예측 결과를 기반으로 효율적인 SD-RAN 설계를 제안


## 2.1 데이터셋 및 분석 방법론
- **데이터셋**: 약 7000개의 기지국에서 수집한 1개월 분량의 트래픽 데이터 사용(음성, 문자, 데이터 서비스 포함)
- **전처리**: 데이터를 시간 간격으로 정량화하여 각 셀에서 트래픽 변화 분석

엔트로피는 Shannon이 불확실성을 측정하기 위해 정의한 값으로, 트래픽의 예측 가능성을 분석하는 데 사용됨

엔트로피의 정의는 다음과 같음

$$ H(X) = -\sum_{i=1}^{n} p(x_i) \log_2 p(x_i) \tag{1} $$

- $$p(x_i)$$: 특정 트래픽 수준 $$x_i$$가 발생할 확률

<div align="center">
  <img src="/assets/img/blog/0114/fig/fig_1.png" alt="Fig. 1">
</div>

Fig 1은 두 개의 셀에서 음성, 문자, 데이터 트래픽의 엔트로피 값을 보여줌
- **음성 트래픽**: 가장 큰 변동성을 보이며, 엔트로피 값이 높음
- **데이터 트래픽**: 가장 안정적이며, 엔트로피 값이 낮음
- 서비스 유형에 따라 트래픽 특성이 달라짐을 나타냄

<div align="center">
  <img src="/assets/img/blog/0114/fig/table_1.png" alt="Table. 1">
</div>


#### 조건부 엔트로피(Conditional Entropy)

트래픽 예측은 과거 데이터를 기반으로 미래 트래픽의 불확실성을 줄이는 것을 목표로 함. 이를 위해 **조건부 엔트로피**를 계산

$$ 
\begin{align}
H(X|Y) &= \sum_{i,j} p(x_i, y_j) \log \frac{p(y_j)}{p(x_i, y_j)} \notag \\
       &= H(X, Y) - H(Y) \tag{2}
\end{align}$$
       
<p align="center">
  <img src="/assets/img/blog/0114/fig/fig_2.png" alt="Left Image" width="45%" style="margin-right: 10px;">
  <img src="/assets/img/blog/0114/fig/fig_3.png" alt="Right Image" width="45%" style="margin-left: 10px;">
</p>


## 2.2 예측 분석

### 2.2.1 시간적 연관성 (Temporal Correlation)

과거 트래픽 데이터는 현재 및 미래 트래픽 예측에 중요한 역할을 함
- Random 엔트로피(사전 정보 X): $$H(X)$$ = 2.1492 bits(음성 트래픽)
- 2시간 전 데이터를 추가로 사용했을 때: Conditional 엔트로피 $$ H(X \vert T)$$ = 0.5880 bits로 감소
- 이는 불확실성이 약 73% 감소했음을 의미하며, 더 긴 기간의 데이터를 사용할수록 불확실성은 더욱 감소

### 2.2.2 공간적 연관성 (Spatial Correlation)

인접한 셀에서의 트래픽 데이터는 예측 정확도를 개선할 수 있음
- 3개의 인접 셀 정보를 사용할 경우 $$H(X \vert S)$$ = 0.9043
- 공간적 정보는 시간적 정보보다 덜 중요한 역할을 함

### 2.2.3 서비스 간 연관성 (Inter-Service Correlation)

다른 서비스 유형 간의 연관성을 활용
- 문자 트래픽은 음성 트래픽 예측에 유용하며, 조건부 엔트로피 $$H(X \vert Text)$$ = 1.3966
- 데이터 트래픽은 독립적인 특성이 강해 다른 서비스의 정보를 활용하기 어려움

## 2.3 Traffic Prediction and Future Network Architecture

### 2.3.1 Traffic-Based SDRAN Architecture

<div align="center">
  <img src="/assets/img/blog/0114/fig/fig_4.png" alt="Fig. 4">
</div>

- 제어 평면과 데이터 평면을 분리하여 네트워크 관리를 유연화
- 구성 요소
  - 트래픽 예측 엔진: 실시간 트래픽 변화 감지
  - 정책 엔진: 자원 할당 및 네트워크 상태 조정
  - API: 외부 어플리케이션과 상호작용

### 2.3.2 Large-Scale Traffic-Aware Resource Management

<div align="center">
  <img src="/assets/img/blog/0113/fig/fig_5.png" alt="Fig 5">
</div>


- 과거 데이터(20-34시간)를 더 많이 사용할수록 RMSE 감소
- 음성 트래픽의 RMSE가 데이터 트래픽보다 더 급격히 감소하여 더 쉽게 예측 가능

### 2.3.3 Small-Scale Flow-Centric Resource Allocation

- 애플리케잉션 요구 사항에 맞춰 트래픽을 세분화하여 자원 배정
  - HTTP 브라우징: WiFi 오프로딩 가능
  - 실시간 스트리밍: 대역폭 우선 할당


## 2.4 Conclusion

- 시간적 연관성이 예측 정확도에 가장 중요한 요소
- 공간적 연관성과 서비스 간 연관성도 보조적인 기여를 함
- SDRAN은 에너지 절약 및 효율적 네트워크 자우너 관리를 위한 중요한 방향성 제시

---

# 3. Take Away
- 엔트로피를 이용한 트래픽 시공간 사전 분석
- ML을 돌릴 때 Training 시간을 조절하면서 결과 비교 그래프 첨부
- 데이터 각 열들간의 상관성을 바탕으로 조건부 엔트로피 계산

