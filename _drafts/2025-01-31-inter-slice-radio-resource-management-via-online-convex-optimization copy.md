---
layout: post
title: Inter-Slice Radio Resource Management via Online Convex Optimization 
description: >
  **Date**: 2021.06.14 <br>
  **Tag**: [Network Slicing], [Online Convex Optimization], [Radio Access Network], [Radio Resource Management]
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

본 논문은 5G 및 그 이후의 네트워크에서 중요한 기술인 `RAN Slicing`의 효율적인 무선 자원 관리를 다룬다. RAN 슬라이스란 하나의 물리적 네트워크에서 여러 개의 가상 무선 네트워크가 독립적으로 작동하는 것을 말한다. 이 논문은 Online Convex Optimization이라는 새로운 방법을 통해 슬라이스 간의 무선 자원을 동적으로 배정하는 문제를 해결한다. 기존의 복잡한 모델 기반 접근법 대신, 이전 할당 데이터를 바탕으로 현재의 자원 배분을 학습하여 성능을 최적화하는 저복잡도 알고리즘을 제안한다. 시뮬레이션 결과, 이 방법이 기존 최적화 전략과 유사한 결과를 보이는 것으로 나타났다.

  
---

# 논문의 구조

1. Introduction
2. System Model
3. Online IS-RRM Via Online Convex Optimization
4. Simulation Results
5. Conclusion

---

# 1. Why this paper

1. 통신 학회 동계 발표회 대비
2. Online Convex Optimization에 대한 이해

## 1.1 What is the research topic and why was it chosen?

- **연구 주제**: RAN 슬라이싱에서 Online Convex Optimization을 이용한 Radio Resource Management
- **선택 이유**
  - **복잡한 RAN 슬라이싱 환경**: 각 네트워크 슬라이스는 서로 다른 Service Level Agreement(SLA)와 동적인 트래픽 패턴을 가지기 때문에 자원 관리가 어려움
  - **기존 방법의 한계**: 기존의 정적 및 모델 기반 자원 관리 방식은 실시간 네트워크 변화에 빠르게 적응하기 어려움
  - **새로운 접근 필요성**: 동적이고 예측하기 어려운 네트워크 상태에 실시간으로 적응하여 자원을 효율적으로 할당하는 기술이 필요
  
## 1.2 What are the objectives of the study?

- 목표 1: 각 네트워크 슬라이스에 동적 자원을 할당하여 packet loss rate(PLR)을 최소화하고 SLA를 만족시킴
- 목표 2: 정적 및 사후 최적 동적 자원 할당 대비 비슷한 성능을 유지하면서도 낮은 계산 복잡도를 보장
- 목표 3: 네트워크의 변화를 실시간으로 반영해 성능을 점진적으로 개선할 수 있는 Online IS-RRM 프레임워크 개발


## 1.3 What methods were used to conduct the research?

- 방법 1: 자원 할당 문제를 Online Convex Optimization으로 모델링
- 방법 2: 전문가 알고리즘을 병렬로 실행하고, 각 라운드에서 성능에 따라 전문가의 가중치를 동적으로 조정하는 메타 알고리즘 적용
- 방법 3: 다양한 트래픽 부하 및 네트워크 변화 조건에서 알고리즘의 성능을 검증하기 위해 시뮬레이션 수행


## 1.4 What results were obtained?

- 결과 1: 제안된 알고리즘은 정적 할당(72%) 대비 높은 셀 부하(82%)에서도 SLA를 충족하고, 사휘 최적 동적 할당(87%)와 유사한 성능을 보임
- 결과 2: 트래픽 변동성이 큰 환경에서도 데이터율 비율이 25:1일 때까지 대응할 수 있었으며, 이는 정적 할당의 15:1보다 뛰어남
- 결과 3: 실시간 네트워크 상황에 적응하여 각 슬라이스에 차별화된 SLA 만족도를 제공함


## 1.5 What is the significance of the results?

- 의의 1: 복잡한 네트워크 모델링 없이 실시간으로 자원 할당을 학습할 수 있는 온라인 최적화 기법을 제안
- 의의 2: 기존 심층 강화학습 기반 방법과 달리 탐색 과정에서 SLA 위반 위험을 줄이고 안정적인 성능을 보장
- 의의 3: 고부하 및 동적 트래픽 환경에서도 확장 가능하고 효율적인 자원 관리가 가능하여 차세대 통신 네트워크에서 활용 가능성이 큼

---

# 2. Paper Summarization

## 2.1 Introduction

- **연구 배경**: 5G 및 그 이후 차세대 네트워크에서 RAN 슬라이싱은 다양한 네트워크 섯비스를 제공하기 위한 핵심 기술로 자리 잡음
- **문제점**: 슬라이스 간 무선 자원 관리는 다양한 SLA를 가지는 여러 슬라이스에 효율적으로 자원을 할당하는 것이 어려움
- **기존 접근**:
  - 평균 자원 사용량 기반 최적화, 단기 성능 지표 변환, 대규모 자우너 공유 등이 연구되었으나 높은 계산 복잡도 발생
  - 심층 강화 학습은 실시간 네트워크에 적응 가능하지만 SLA 위반 및 잦은 튜닝 필요
- **목표**: 복잡한 모델링 없이 OCO를 통해 실시간으로 자원 할당을 점진적으로 최적화하는 프레임워크 제안

## 2.2 System Model


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
