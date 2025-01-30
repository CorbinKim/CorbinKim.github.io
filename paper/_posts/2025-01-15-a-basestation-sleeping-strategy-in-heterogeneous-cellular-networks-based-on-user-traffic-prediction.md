---
layout: post
title: A Base Station Sleeping Strategy in Heterogeneous Cellular Networks Based on User Traffic Prediction
description: >
  **Date**: 2014.06.17 <br>
  **Tag**: [Heterogeneous cellular networks], [Traffic forecasting], [Energy saving], [SINR], [Quality of service], [BLSTM]
image: 
  path: /assets/img/blog/0115/thumbnail/thumbnail.png
  srcset: 
    1920w: /assets/img/blog/0115/thumbnail/thumbnail.png
    960w:  /assets/img/blog/0115/thumbnail/thumbnail@0,5x.png
    480w:  /assets/img/blog/0115/thumbnail/thumbnail@0,25x.png

excerpt_separator: <!--more-->
sitemap: true
hide_last_modified: true
---

<!--more-->
- Table of Contents
{:toc .large-only}

# Abstract

셀룰러 네트워크의 실시간 트래픽은 시간에 따라 변하며, 주간/야간과 같은 tide 패턴을 보임. 이 특성을 활용하여 네트워크 전반에 분산된 작업 부하를 소수의 기지국으로 통합하여 에너지 소비를 줄일 수 있음. 본 연구는 Macro 기지국과 Micro 기지국으로 구성된 2단계 HetNet을 대상으로 기지국 절전 전략을 제안함. BLSTM(Bidirectional Long Short-Term Memory)을 이용하여 각 사용자의 미래 트래픽을 예측하고, 이를 기반으로 MiBS의 절전 및 User association 재배치를 수행함. Micro 기지국은 항상 활성 상태를 유지하며, 사용자 서비스 품질은 SINR 임계값을 준수하도록 보장함.

  
---

# 논문의 구조

1. Introduction
2. Related Work
3. System Model
4. Problem Formulation
5. Proposed MiLSF Strategy
6. Numerical Results
7. Conclusion

---

# 1. Why this paper

1. SKT 트래픽 예측 논문 레퍼런스 조사
2. 트래픽 예측을 통한 Cell on/off

## 1.1 What is the research topic and why was it chosen?

- **연구 주제**: HetNet에서 사용자 트래픽 예측을 활용한 에너지 절감 전략
- **선택 이유**
  - 트래픽의 급격한 증가로 네트워크 에너지 소비가 크게 증가함
  - 에너지 소비를 줄이는 것은 운영 비용 절감과 온실가스 배출 감소를 위해 매우 중요함
  
## 1.2 What are the objectives of the study?

- 낮은 부하 시간대에 기지국 절전 전략을 개발하여 이종 셀룰러 네트워크의 에너지 소비를 줄이는 것
- BLSTM(Bidirectional Long Short-Term Memory) 신경망을 활용하여 사용자별 트래픽 수요를 정확히 예측
- 모든 사용자의 QoS를 유지하며, 사전에 정의된 SINR(신호 대 간섭 잡음비) 임계값을 충족하도록 보장


## 1.3 What methods were used to conduct the research?

- 트래픽 예측: BLSTM 신경망을 사용해 과거 트래픽 데이터를 기반으로 사용자별 미래 트래픽을 예측
- 네트워크 모델링: HetNet을 Macro BS와 Micro BS로 구성된 2단계 네트워크로 모델링하고, 기지국 위치를 PPP와 MHCPP로 시뮬레이션
- 제안된 전략: MiLSF(Minimum Load Sleep First) 전략을 개발하여 부하가 적은 MiBS를 우선적으로 절전 모드로 전환하고, 사용자를 활성 기지국으로 재배치
- 시뮬레이션: 다양한 배치 시나리오와 네트워크 조건에서 MiLSF와 기존 절전 전략 4가지를 비교 분석

## 1.4 What results were obtained?

- MiLSF는 기존 4가지 전략(Randomly Sleep, Randomly Reallocate Users, Clsest User Reallocation, Closest Base Station Sleep First)보다 모든 시나리오에서 우수한 에너지 절약 성과를 보임
- MHCPP를 활용한 기지국 배치가 PPP보다 높은 에너지 절약 효과를 가져옴
- 중간 수준의 사용자 트래픽 부하와 적당한 SINR 임계값에서 에너지 절약 효과가 극대화됨
- MiLSF는 사용자를 효과적으로 재배치하여 더 많은 MiBS를 절전 모드로 전환할 수 있었음


## 1.5 What is the significance of the results?

- **에너지 효율성**: HetNet에서 에너지 소비를 효과적으로 줄이는 실질적이고 실현 가능한 방법 제시
- **서비스 품질 보장**: 에너지 절약과 사용자 QoS 동시에 달성
- **연구 기여**: AI 기반 트래픽 예측과 에너지 효율적 네트워크 운영 전략의 통합 가능성을 제시하여 관련 연구를 발전시킴

---

# 2. Paper Summarization

## 2.1 Introduction

- **연구 배경**: 모바일 기기와 데이터 트래픽의 증가로 셀룰러 네트워크 에너지 소비 증가. 기지국이 네트워크 에너지 소비의 80% 이상 차지
- **문제점**: 기존 네트워크는 에너지 효율성이 낮으며, 사용자 QoS를 유지하면서 에너지 소비를 줄이는 방법이 필요
- **제안 내용**: BLSTM 기반 트래픽 예측을 통해 사용자별 트래픽을 분석하고, MiBS를 절전 상태로 전환하는 MiLSF 전략을 제안
- **목표**: 에너지 소비 감소와 서비스 품질 유지

## 2.2 Related Work

- **에너지 절감 HeCN 연구**: MiBS를 활용한 네트워크 효율성 개선 방안 연구
- **트래픽 예측**: ARIMA, RNN, LSTM 등 다양한 모델 사용. BLSTM은 특히 시간 종속성을 잘 학습하여 높은 예측 정확도를 제공
- **기지국 절전 전략**: 사용자 할당 및 네트워크 부하 분산을 고려한 절전 방식 연구. 기존 연구는 BS 트래픽 예측에 초점, 사용자별 요구를 반영하지 못함

## 2.3 System Model


### 2.3.1 네트워크 구성
- 구조: 이종 셀룰러 네트워크(HeCN)는 Macro BS(MaBS)와 Micro BS(MiBS)으로 구성
  - MaBS: 넓은 영역 커버리지, 높은 송신 전력, 항상 활성 상태 유지
  - MiBS: 좁은 영역 커버리지, 낮은 송신 전력, 부하에 따라 절전 가능


<p align="center">
  <img src="/assets/img/blog/0115/fig/fig.1.1.png" alt="Left Image" width="45%" style="margin-right: 10px;">
  <img src="/assets/img/blog/0115/fig/fig.1.2.png" alt="Right Image" width="45%" style="margin-left: 10px;">
</p>


- 배치 방식:
  - **PPP(Poisson Point Process)**: BS들이 독립적으로 배치되며, 현실적인 네트워크 배치를 모델링 가능
  - **MHCPP(Matern Hard-Core Point Process)**: PPP 기반 배치에서 BS 간 간섭을 줄이기 위해 최소 거리 제약 추가


### 2.3.2 트래픽 예측 모델
- BLSTM(Bidirectional Long Short-Term Memory)
  - 과거 트래픽 데이터를 기반으로 사용자별 미래 트래픽 수요를 예측
  - 양방향 정보 흐름으로 시간 의존성과 장기적인 패턴 학습 가능
  - BLSTM은 높은 예측 정확도를 제공하며, 특히 피크 트래픽에서 RNN 및 ARIMA보다 우수


### 2.3.3 SINR 모델

| **기호**         | **설명**                                                                              | **단위**                     |
|------------------|--------------------------------------------------------------------------------------|-----------------------------|
| $$ S_{i,k} $$    | 사용자 $$ k $$가 기지국 $$ i $$에서 수신한 SINR                                          | dB               |
| $$ p_{\theta(i)} $$ | 기지국 $$ i $$의 송신 전력 (단일 안테나 기준)                                           | W                   |
| $$ f_{\theta(i)} $$ | 기지국 $$ i $$의 주파수                                                               | Hz                         |
| $$ w_{\theta(i)} $$ | 기지국 $$ i $$의 대역폭                                                              | Hz                         |
| $$ L_{i,k} $$    | 사용자 $$ k $$와 기지국 $$ i $$ 간의 경로 손실                                            | dB               |
| $$ \rho_{i,k} $$ | 사용자 $$ k $$와 기지국 $$ i $$ 간의 소규모 페이딩 계수 (Rayleigh fading, 지수분포)         | -                    |
| $$ \eta_0 $$     | 잡음 스펙트럼 밀도 (Noise spectral density)                                            | W/Hz                      |
| $$ d_{i,k} $$    | 사용자 $$ k $$와 기지국 $$ i $$ 간의 거리                                                | m                   |
| $$ c $$          | 빛의 속도 ($$3 \times 10^8$$)                                                          | m/s                       |
| $$ \beta $$      | 경로 손실 지수 (Path loss exponent)                                                    | -                     |
| $$ \gamma_0 $$   | SINR 임계값                                                                            | dB               |
| $$ \Psi_{M} $$   | 거대 기지국(MaBS) 집합                                                                 | -                          |
| $$ \Psi_{S} $$   | 소형 기지국(MiBS) 집합                                                                 | -                          |
| $$ \Psi_{K} $$   | 사용자 집합                                                                             | -                          |
| $$ \theta(i) $$  | 기지국 $$ i $$의 유형 (MaBS: 1, MiBS: 2)                                               | -                     |


#### 2.3.3.1 기지국 유형 정의 ($$ \theta(i) $$)

기지국 $$ i $$의 유형을 나타내는 이진 값:

$$
\theta(i) =
\begin{cases} 
1, & \text{if } i \in \Psi_{M}, \\
2, & \text{if } i \in \Psi_{S}.
\end{cases}
$$


#### 2.3.3.2 경로 손실 모델 ($$ L_{i,k} $$)

사용자 $$ k $$와 기지국 $$ i $$ 간의 경로 손실:

$$
L_{i,k} = 20 \log \left( \frac{4 \pi f_{\theta(i)}^c}{c} \right) 
+ 10 \beta \log(d_{i,k}),
\quad \forall k \in \Psi_{K}, \ i \in \Psi_{M} \cup \Psi_{S}.
$$

#### 2.3.3.3 SINR 계산 ($$ S_{i, k}$$)

사용자 $$ k $$가 기지국 $$ i $$에서 수신한 SINR:

$$
S_{i,k} = \frac{p_{\theta(i)} \rho_{i,k} L_{i,k}^{-1}}
{\sum_{j \in \Psi_{M} \cup \Psi_{S} \setminus \{i\}} 
p_{\theta(j)} \rho_{j,k} L_{j,k}^{-1} 
+ \eta_0 w_{\theta(i)}},
\quad \forall k \in \Psi_{K}, \ i \in \Psi_{M} \cup \Psi_{S}.
$$


### 2.3.4 BS 전력 소비 모델

| **기호**             | **설명**                                                                           | **단위**         |
|----------------------|-----------------------------------------------------------------------------------|-----------------|
| $$ \mu_i(t) $$       | 시간 $$ t $$에서 기지국 $$ i $$의 부하 비율                                           | -    |
| $$ \Psi_i^K(t) $$    | 시간 $$ t $$에 기지국 $$ i $$에 연결된 사용자 집합                                     | -               |
| $$ P_{\theta(i)}^\alpha $$         | 기지국 활성 상태 전력 소비                                              | W               |
| $$ \alpha_{\theta(i)} $$ | 기지국 $$ i $$의 송신 안테나 개수 (MaBS: $$ \alpha_1 $$, MiBS: $$ \alpha_2 $$)       | -               |
| $$ p_{\theta(i)}^{c} $$ | 기지국 $$ i $$의 회로 전력 소비(절전 상태)                                                     | W               |



#### 2.3.4.1 사용자 요구 대역폭 계산

사용자 $$k$$가 기지국 $$i$$에 연결되었을 때, 주어진 시간 $$t$$에서 SINR이 임계값 $$\gamma_{0}$$ 이상이면, Shannon-Hartley 이론에 따라 요구 대역폭은 아래와 같이 계산

$$
b_{i,k}(t) = \frac{r_k(t)}{\log_2 \left( 1 + S_{i,k} \right)}, \forall S_{i,k} \geq \gamma_0
$$


#### 2.3.4.2 기지국 부하 계산

기지국 $$i$$에 연결된 사용자들의 요구 대역폭으로부터 부하 비율을 계산할 수 있음. 시간 $$t$$에서 기지국 $$i$$의 부하는 다음과 같이 정의됨

$$
\mu_i(t) = \sum_{k \in \Psi_K^i(t)}\frac{b_{i,k}(t)}{w_{\theta(i)}}
$$


#### 2.3.4.3 기지국 전력 소비 모델

활성 상태에서의 기지국 $$i$$의 전력 소비는 **송신 전력**과 **회로 전력**으로 나뉨

$$
P_{\theta(i)}^{\alpha}(t) = \alpha_{\theta(i)}p_{\theta(i)}\mu_i(t) + p_{\theta(i)}^c
$$


#### 2.3.5 BLSTM 모델

![Fig 1](/assets/img/blog/0115/fig/BLSTM.png)

- BLSTM(Bidirectional Long Short-Term Memory)
  - 시계열 데이터를 양방향으로 학습하는 RNN(Recurrent Neural Network)의 한 종류
  - 과거와 미래 정보를 모두 활용하여 더 정확한 예측 수행
  - LSTM의 구조를 확장하여 Long-term dependencies와 패턴을 효과적으로 학습함

- 사용 목적
  - 네트워크 트래픽의 시간적 변화 패턴을 예측
  - 각 사용자별 미래 트래픽을 정확히 예측하여 기지국 절전 저략에 활용


BLSTM 모델은 두 개의 LSTM 네트워크(Forward와 Backward)로 구성됨

- Forward LSTM: 입력 데이터를 시간 순서대로 처리하여 패턴을 학습
- Backward LSTM: 입력 데이터를 시간 역순으로 처리하여 추가적인 정보를 학습
- 두 결과를 병합하여 최종 출력값을 생성



### 2.4 문제 정의

- **목표**: MiBS를 선택적으로 절전 상태로 전환해 네트워크 에너지 소비를 최소화
- **제약조건**:
  - 모든 사용자의 SINR이 임계값 이상이어야 함
  - 각 사용자의 트래픽 요구량을 충족해야 함
  - 기지국은 과부하 상태가 되어서는 안됨
- **최적화 문제**: 에너지 소비를 최소화하는 MiBS 절전 전략 설계


#### 2.4.1 변수 정의

- Action Vector($$a_t^{\phi}(t)$$)
: 기지국의 활성 상태를 나타내는 벡터

  - $$ a_{\phi}^{i}(t) = 1 $$: 시간 $$t$$에 기지국 $$ i $$가 활성 상태
  - $$ a_{\phi}^{i}(t) = 0 $$: 시간 $$t$$에 기지국 $$ i $$가 절전 상태

- 활성 및 절전 기지국 집합
  - $$ \mathcal{L}^{active}(t) = \{i \vert a_i^{\phi}(t = 1)\} $$: 시간 $$t$$에 활성 상태인 기지국 집합
  - $$ \mathcal{L}^{active}(t) = \{i \vert a_i^{\phi}(t = 0)\} $$: 시간 $$t$$에 절전 상태인 기지국 집합


- 최대 트래픽 요구량($$R_k$$)

$$
R_k = \max_{t \in [T_1, T_2]} r_k(t), \quad \forall k \in \Psi_K.
$$


#### 2.4.2 최적화 목표

- $$[T_1, T_2]$$ 동안 두 계층 HeCN의 전체 에너지 소비를 최소화하는 것이 최적화 문제의 목표
- 총 전력 소비: 시간 $$t$$에 모든 기지국의 총 전력 소비는 다음과 같이 정의됨

$$
\min_{\phi} \int_{T_1}^{T_2}
\sum_{i \in \Psi_M \cup \Psi_S}
\left( a_i^\phi(t) P^\alpha_{\theta(i)}(t)
+	\left( 1 - a_i^\phi(t) \right) P_{\theta(i)}^s \right) dt,
$$


### 2.5 Proposed MiLSF Strategy

Minimum Load Sleep First Algorithm(MiLSF)는 부하가 적은 MiBS부터 절전 상태로 전환하여 네트워크의 에너지 소비를 줄이는 전략임

#### 2.5.1 알고리즘 목표

- 네트워크 에너지 소비를 줄이기 위해 부하가 낮은 MiBS를 절전 상태로 전환
- 사용자의 QoS를 유지하면서 기지국 부하를 재분배


#### 2.5.2 알고리즘 절차

![Fig 5](/assets/img/blog/0115/fig/MiLSF.png)


##### Step 1. 초기화

1. 활성 상태의 모든 MiBS 집합을 정의

$$ \mathcal{I}_{\text{active}}(t) = { i \mid a_i^\phi(t) = 1, i \in \Psi_S } $$


2. 절전 상태 기지국 집합 초기화

$$ \mathcal{I}_{\text{sleep}}(t) = \emptyset $$


#### Step 2. MiBS 부하 정렬

활성 상태 MiBS의 부하를 기준으로 오름차순 정렬 

$$ i_1, i_2, \ldots, i_N \in \mathcal{I}{\text{active}}(t), \quad \text{where } \mu{i_1}(t) \leq \mu_{i_2}(t) \leq \cdots \leq \mu_{i_N}(t) $$


#### Step 3. 절전 가능 여부 평가

부하가 가장 낮은 MiBS부터 절전 가능 여부를 평가

##### 1. MiBS $$i$$의 사용자를 인접한 활성 기지국으로 재배치

$$
\mu_j(t) = \mu_j(t) + \sum_{k \in \Psi_i^K(t)} \frac{b_{j,k}(t)}{w_{\theta(j)}},
\quad j \in \mathcal{I}_{\text{active}}(t) \setminus {i}.
$$

##### 2. 제약 조건 확인

- 모든 사용자의 SINR: $$ S_{j,k} \geq \gamma_0, \quad \forall k \in \Psi_i^K(t), \quad \forall j \in \mathcal{I}_{\text{active}}(t) $$
- 기지국 부하: $$ \mu_j(t) \leq 1, \quad \forall j \in \mathcal{I}_{\text{active}}(t) $$

##### 3. 조건이 만족되면 MiBS $$i$$를 절전 상태로 전환

$$
a_i^\phi(t) = 0, \quad \mathcal{I}{\text{sleep}}(t) = \mathcal{I}{\text{sleep}}(t) \cup {i}
$$

##### 4. 조건이 만족되지 않으면 MiBS $$i$$는 활성 상태 유지


#### Step 4: 반복

절전 가능 여부를 평가한 MiBS를 제외한 나머지 기지국으로 돌아가 Step 3을 반복, 모든 MiBS를 평가할 때까지 반복함


#### 2.5.3 알고리즘 종료 조건
- 모든 MiBS를 평가한 후 더 이상 절전 상태로 전환할 수 없는 경우 알고리즘 종료
- 절전 상태 기지국 집합 $$\mathcal{J}_{sleep}(t)$$과 활성 상태 기지국 집합 $$\mathcal{J}_{active}(t)$$ 반환


## Numerical Results 

### 실험 목표

- BLSTM 기반 트래픽 예측 모델과 MiLSF 알고리즘의 성능 평가
- 기존 절전 전략과의 비교를 통해 MiLSF의 에너지 효율성 및 QoS 유지 능력을 검증


### BLSTM 트래픽 예측 성능

##### 실험 설정
  - 다양한 트래픽 패턴에서 BLSTM의 예측 성능 평가
  - 비교 모델: RNN, ARIMA



![Fig 7](/assets/img/blog/0115/fig/fig.7.png)
![Fig 8](/assets/img/blog/0115/fig/fig.8.png)
![Fig 9](/assets/img/blog/0115/fig/fig.9.png)


##### 결과 요약

![Fig 6](/assets/img/blog/0115/fig/MAE.png)


예측 정확도:
  - BLSTM은 RNN 및 ARIMA 보다 Mean Absolute Error(MAE)와 Root Mean Square Error(RMSE)에서 더 낮은 값을 기록
  - 특히 트래픽 피크 시간에서 예측 성능이 우수


시계열 데이터의 학습:
  - BLSTM은 양방향 학습을 통해 장기적이고 복잡한 트래픽 변화를 더 잘 포착
을

### MiLSF 알고리즘 성능

##### 실험 설정

![Table 1](/assets/img/blog/0115/fig/table.1.png)


- 다양한 네트워크 부하와 배치 조건에서 MiLSF와 기존 절전 전략의 비교. 추가적으로 low-load 기간(10:00 p.m. - 6:00 a.m.)에는 user들의 움직임이 없는 것으로 고려하였음.

$$\rightarrow$$ 결정한 MiBS들을 10:00 p.m. - 6:00 a.m.에 sleep 모드로 전환
$$\rightarrow$$ 이 시간대 sleep 할 최적의 MiBS들을 고르는 것이 중요
  

- 비교 전략
  - Randomly Sleep(RS): 임의로 기지국을 절전 모드로 전환
  - CUR(Closest User Reallocation): 사용자 재배치를 통해 가까운 기지국 연결
  - CBSSF(Closest Base Station Sleep First): 가장 가까운 기지국부터 절전


#### 결과 요약

- 에너지 절감
  - MiLSF가 RS, CUR, CBSSF보다 에너지 소비를 크게 줄임
  - 특히 네트워크 부하가 낮은 시나리오에서 에너지 절감률이 가장 높음

- 기지국 배치의 영향
  - PPP 배치: MiLSF가 효율적으로 작동하며, 부하 분산 효과를 극대화
  - MHCPP 배치: 간섭이 줄어들며, MiLSF의 에너지 절감률이 더욱 향상

- 사용자 수의 영향
  - 사용자 수가 증가할수록 MiLSF는 에너지 절감률을 유지하면서 QoS를 만족
  - 기존 전략은 사용자 증가 시 QoS가 약화되는 경향을 보임


![Fig 10](/assets/img/blog/0115/fig/fig.10.png)


- SINR 임계값 변화
  - 높은 SINR 임계값에서도 MiLSF는 QoS를 유지하며, 에너지 절감 효과를 제공

![Fig 10](/assets/img/blog/0115/fig/fig.10.png)



- 절전 기지국 개수 변화
  - 네트워크 부하가 낮을수록 더 많은 MiBS를 절전 상태로 전환 가능
  - MiLSF는 절전 가능한 MiBS의 개수를 최대화하면서 QoS를 유지
  - 네트워크 부하가 증가하면 MiBS를 활성 상태로 유지해야 하므로 절전 기지국 개수 감소


![Fig 11](/assets/img/blog/0115/fig/fig.11.png)



## Future Work

- 빔포밍, 전력 제어와 같은 간섭 완화 기법 통합
- 동적으로 변화하는 네트워크 환경에서의 적용
- 트래픽 예측의 개선


---

# 3. Take Away

- 시뮬레이션 파라미터들을 참고하여 NS-3에서 사용
- 10 p.m. - 6 a.m. 까지 사용자를 고정시킨 후 cell on/off를 실행
- 예측 알고리즘과 on/off 알고리즘의 결합
