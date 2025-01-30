---
layout: post
title: Joint Traffic Prediction and Base Station Sleeping for Energy Saving in Cellular Networks
description: >
  **Date**: 2021.08.06, 
  **Tag**: [Base station sleeping], [Long short-term memory], [Traffic prediction]
image: 
  path: /assets/img/blog/prediction_sleep/Prediction_Sleep.png
  srcset: 
    1920w: /assets/img/blog/prediction_sleep/Prediction_Sleep.png
    960w:  /assets/img/blog/prediction_sleep/Prediction_Sleep@0,5x.png
    480w:  /assets/img/blog/prediction_sleep/Prediction_Sleep@0,25x.png
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: true 
---

<!--more-->

* toc
{:toc .large-only}

## 1. Why this paper?
- 졸업 논문 레퍼런스
- 트래픽 예측을 발전시킬 수 있는 연구
- MINLP 문제 연습

---

## 2. Paper Summary

### 2.1 Introduction
대부분의 기지국들은 미리 정해둔 threshold 값보다 traffic load가 작아지게 되면 Sleep mode로 전환하는 방식으로 에너지를 절약하고 있다. 논문에 따르면 17% 정도의 기지국들이 하루에 50-99% 정도 low traffic을 가지고 있다. 

기지국 Sleeping 알고리즘의 key point는 다음과 같다.
1. 어떤 기지국들이 Sleep mode로 전환되어야 하는가?
2. 언제 Sleep mode로 전환되어야 하는가?

기지국 traffic load의 변동성을 파악할 때, 견고한 traffic prediction은 중요한 역할을 한다.

본 논문에서는 에너지 소비를 최소화하면서 bandwidth budget, spectral efficiency 요구사항 그리고 특히 traffic 요구사항을 만족시키기 위해 traffic load가 적은 기지국을 적절한 간격으로 종료하는 방법을 찾는 것을 목표로 한다.

- Traffic prediction
  - LSTM 사용
- BS Sleeping Problem 최적화 
  - MINLP 문제 사용
  - 3-step local search 알고리즘 사용

### 2.2 Network Model and Problem Formulation

#### 2.2.A Traffic Model
![Figure1](/assets/img/blog/0926/Figure_1.png)

- Region: $$\mathcal{D} \in R^2$$
- 기지국: $$\mathcal{N} - \{1,2,...,N\}$$
- Traffic Demand Areas(TDA): $$\mathcal{K} - \{1,2,...,K\}$$
  - 각 TDA는 서로 다른 트래픽 요구사항을 가진 여러명의 사용자들을 포함
    - 서비스 지역: $$x \in \mathcal{D}$$
      - $$\mathcal{D}_{k}$$: TDA $$k$$의 서비스 지역
    - 서비스 지역에서 요구하는 트래픽: $$\Phi (x)$$
      - $$R_{k}$$: TDA $$k$$의 트래픽 요구사항

$$ 
\iint_{D_k} \Phi(x) \, d\sigma = R_k
\tag{1}
$$

- $$h_{k,n}$$: BS $$n$$과 TDA $$k$$ 사이의 channel gain
- $$b_{k,n}$$: TDA $$k$$에 있는 BS $$n$$의 bandwidth
- $$p_{k,n}$$: TDA $$k$$에 있는 BS $$n$$의 power

이를 이용해서 BS $$n$$과 TDA $$k$$ 사이의 transmission rate는 다음과 같이 계산할 수 있다.

$$
r_{k,n} = b_{k,n} \log_2 \left[ 1 + \frac{p_{k,n} |h_{k,n}|^2}{b_{k,n} (N_0 + I_{k,n})} \right]
\tag{2}
$$

- $$N_0$$: noise power
- $$I_{k,n}$$: interference power
  - 본 논문에서는 signal processing 기술을 사용하여 $$I_{k,n}$$을 0으로 만들었다 가정

따라서 $$p_{k.n}$$은 아래와 같이 다시 정리할 수 있다.

$$
p_{k,n} = \frac{N_0 b_{k,n}}{|h_{k,n}|^2} \cdot \left(2^{\frac{r_{k,n}}{b_{k,n}}} - 1\right)
\tag{3}
$$

- \mathcal{K}_{n}: BS $$n$$에 의해 서비스 되는 TDA들의 집합
- Region $$D$$의 총 트래픽 요구사항은 모든 TDA의 트래픽 요구사항의 합과 같다.

$$
R_D = \sum_{k \in \mathcal{K}} R_k = \sum_{n \in \mathcal{N}} \sum_{k \in \mathcal{K}_n} r_{k,n} = \sum_{n \in \mathcal{N}} r_n
\tag{4}
$$

- $$r_n$$: BS $$n$$에 의해 서비스되는 총 트래픽 요구사항



#### 2.2.B Problem Model

밀집된 네트워크에서 총 전력 소모량 $$P_{total}$$은 아래와 같이 나타낼 수 있다.

$$
P_{\text{total}} = \sum_{n \in \mathcal{N}} P_f^n + \sum_{n \in \mathcal{N}} P_t^n
\tag{5}
$$

- $$P_f^n$$: BS $$n$$의 fixed power consumption
- $$P_t^n$$: BS $$n$$의 transmission power consumption

이 때, binary 변수 $$x_n$$을 사용하여 BS $$n$$의 sleep 여부를 나타낸다.

$$
x_n =
\begin{cases}
1, & \text{BS } n \text{ is active}, \\
0, & \text{BS } n \text{ is inactive}.
\end{cases}
\tag{6}
$$

$$P_f^{n}$$은 BS의 상태에 영향을 받지만 BS가 sleep 상태일 떄엔 무시할 수 있다. 즉, BS가 sleep 모드에서 꺠어나는 데 전력을 소모하더라도, BS가 활성화된 경우에 비해 그 전력은 무시할 수 있을 정도로 작다. 

따라서 총 전력 소비량 $$P_{total}$$은 다음과 같이 변환된다.

$$
P_{\text{total}} = \sum_{n \in \mathcal{N}} P_f^n x_n + \sum_{n \in \mathcal{N}} \frac{x_n}{\eta_n} \sum_{k \in \mathcal{K}} p_{k,n},
\tag{7}
$$

- $$\eta_{n}$$: Power amplifier efficiency factor

#### 2.2.C Problem Formulation

우리의 목적은 전체 전력 소모를 최소화하며 practical한 제약사항들을 만족하는 일련의 BS들을 골라내는 것이다.

- $$p_n^{max}$$: BS n의 최대 transmission power
- $$b_n^{max}$$: BS n의 사용 가능한 bandwidth 

풀어야 할 `최적화 문제`는 아래와 같이 나타낼 수 있다.

$$
\begin{align}
    \text{minimize} \quad & P_{\text{total}} \\
    \text{s.t.} \quad & C_1: \sum_{k \in \mathcal{K}} p_{k,n} \leq x_n p_n^{\text{max}}, \quad \forall n \in \mathcal{N}, \\
    & C_2: \sum_{k \in \mathcal{K}} b_{k,n} \leq x_n b_n^{\text{max}}, \quad \forall n \in \mathcal{N}, \\
    & C_3: \sum_{n \in \mathcal{N}} r_{k,n} \geq R_k, \quad \forall k \in \mathcal{K}, \\
    & C_4: p_{k,n} \geq \Delta_{k,n} b_{k,n}, \quad \forall k \in \mathcal{K}, \forall n \in \mathcal{N}, \\
    & C_5: \vec{x} \in X, \quad \vec{b} \in \mathbb{R}_+^{K \times N}, \quad \vec{p} \in \mathbb{R}_+^{K \times N}.
\end{align}
$$

- $$P_{total}$$을 최소화하는 것이 목적
  - $$C_1$$: 각 BS $$n$$에 대해 사용자 $$k$$의 전력 $$p_{k,n}$$의 합이 BS $$n$$의 최대 전력 $ㅔp_n^{max}$$를 초과하지 않아야 하며, 이는 $$x_n$$의 활성화 여부에 따라 달라짐
  - $$C_2$$: 각 BS $$n$$에 대해 사용자 $$k$$의 bandwidth $$b_{k.n}$$의 합이 노드 $$n$$의 최대 bandwidth $$b_n^{max}$$을 초과하지 않아야 하며, 이는 $$x_n$$의 활성화 여부에 따라 달라짐
  - $$C_3$$: 각 사용자 $$k$$의 총 데이터 전송 속도 $$r_{k,n}$$은 사용자 요구 rate $$R_k$$ 이상이여야 함
  - $$C_4$$: 각 사용자 $$k$$와 노드 $$n$$에서 할당된 전력 $$p_{k,n}$$은 할당된 대역폭 $$b_{k,n}$$에 비례하여 $$\delta_{k,n}$$으로 제한됨
  - $$C_5$$: $$\overrightarrow{x}$$는 정의된 집합 $$\mathbb{X}$$에 속하고, $$\overrightarrow{b}$$와 $$\overrightarrow{p}$$는 음수가 아닌 실수 공간에 속해야 함


Service area의 트래픽 요구사항 distribution은 인구 이동에 따라 하루에도 수십번씩 바뀌게 된다. 따라서 식 (8)에 정의되어 있는 문제를 풀기 위해선 각 TDA의 future rate requirement를 예측해야 한다. 이를 위해 단일 BS에 모두 시계열 예측을 사용하게 된다. 

- 수집된 데이터
  - 주어진 데이터셋은 $$R_{BS} = \{R_{B1}, R_{B2}, ..., R_{BN}\}$$로, 여기서 각 $$R_{B_{n}} = \{r_1^{n}, r_2^{n}, ..., r_t^{n}\}$$는 기지국 $$n$$의 트래픽 데이터를 저장
  - $$delta$$는 데이터가 수집된 시간 간격을 의미
- One-step 예측
  - $가\delta$$ 간격에서의 트래픽을 예측하는 것은 one-step 예측으로 간주
- Multi-step 예측
  - 기지국의 on/off switching에 관련된 예측에서는 multi-step 예측이 필요함. 이는 일반적으로 트래픽 데이터의 시간 간격 $$\delta$$가 기지국을 켜고 끄는 허용 가능한 시간 간격보다 훨씬 작기 때문
- 예측 시간 간격:
  - Multi-step 예측에서는 $$z$$개의 time step을 예측해야 하며, 이 때 예측 간격은 $$T_{pred} = \delta z$$로 정의
- 전체 트래픽 수요 계산:
  - 시간 구간 $$[t, t+T_{pred}]$$ 동안 지역 전체의 트래픽 수요는 다음과 같이 계산
  
  $$
  R_D = \sum_{n \in \mathcal{N}} \sum_{j=t+1}^{t+z} \frac{r_j^n}{z}
  $$

### 3. Our Proposed Algorithm
#### 3.A Cellular traffic prediction
#### 3.B Base station sleeping
Power와 bandwidth allocation 문제를 먼저 풀어야 한다. 주어진 기지국 집합에서 정의된 $$TDA_{k}$$의 기본 속도 요구사항보다 마진을 더해 더 높은 $$R'_{k}$$를 만족시켜야 한다. 이 문제는 식 (13)으로 수식화되며, 이를 통해 power와 bandwidth 할당을 수행하게 된다.

$$
\begin{aligned}
\text{find} & \quad \overrightarrow{b}, \overrightarrow{p} \\
\text{s.t.} & \quad \sum_{n \in \mathcal{N}'} b_n T_{k,n} = R_k', \quad \forall k \in \mathcal{K}, \\
& \quad C_1, C_2, C_1 \text{ in (8)}.
\end{aligned},
\tag{13}
$$


만약 식 (13)에 대한 실현 가능한 해가 존재한다면, 선택된 기지국 집합 ($$  N_s = \{ n \mid x_{n}=1 \} $$) 이 bandwidth 및 power 제한 이내에서 TDA의 속도 요구사항을 충족할 수 있다 말할 수 있다. 식 (13)은 `convex optimization algorithm`으로 해결할 수 있다. 또한 이와 동일한 방식으로 (8) 식도 해결할 수 있다. 

이후, `Local search` 알고리즘을 통해 최적의 기지국 하위 집합을 찾는다. 알고리즘은 `Open`, `Close`, `Exchange` 이 세가지 단계로 이루어져 있으며, 각각의 단계에서 시스템의 power 소비를 업데이트하여 기지국을 추가하거나 제거하거나 교환하는 방식으로 최적의 구성을 찾는다.

