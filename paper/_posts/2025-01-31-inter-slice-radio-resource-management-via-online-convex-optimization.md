---
layout: post
title: Intent-Aware Radio Resource Scheduling in a RAN Slicing Scenario Using Reinforcement Learning
description: >
  **Date**: 2021.06.14 <br>
  **Tag**: [Radio resource scheduling], [RAN slicing], [Intent-aware scheduling], [Reinforcement learning]
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
2. Related Work
3. Communication System Model and Problem Formulation
4. Proposed Intent-Aware RRS Using Reinforcement Learning
5. Simulation Results
6. Conclusion

---

# 1. Why this paper

1. 통신 학회 동계 발표회 대비
2. 오픈소스 시뮬레이터를 이용한 알고리즘 제작

## 1.1 What is the research topic and why was it chosen?

- **연구 주제**: RAN 슬라이싱에서 Intent Aware Radio Resource Scheduling을 강화학습을 습용한 Radio Resource Management를 강화학습을 활용해 최적화
- **선택 이유**
  - 5G 네트워크에서는 서비스별로 다른 QoS 요구사항이 존재하여 네트워크 슬라이싱이 필수적
  - 무선 자원이 제한적이므로 효율적 관리가 중요
  - 기존 RRS 기법은 슬라이스별 의도를 충분히 고려하지 못하거나 변화하는 네트워크 상태에 적응하지 못하는 한계가 있음
  - 데이터 기반의 동적 자원 관리가 필요한 상황
  
## 1.2 What are the objectives of the study?

- 목표 1: 슬라이스 간 자원 할당을 최적화하여 각 슬라이스의 QoS 요구를 충족
- 목표 2: Intent Drift를 방지하여 네트워크 상태 변화르 인한 QoS 위반 방지
- 목표 3: 실시간 네트워크 상태에 적응할 수 있는 동적 자원 관리 제공
- 목표 4: eMBB, URLLC, BE 슬라이스 별 고유한 요구사항을 지원

## 1.3 What methods were used to conduct the research?

- 강화 학습 방법: Soft Actor-Critic (SAC) 알고리즘을 사용
- 구체적 방법:
  - 관측 공간 정의: 네트워크 상태와 슬라이스 QoS 요구사항을 포함하는 관측 공간을 설계
  - 보상 함수 설계: 슬라이스별 QoS 요구 충족 여부를 평가하고, intent에서 벗어날 경우 이를 교정할 수 있는 보상 함수 설계
  - 시뮬레이션 환경: QuaDRiGa 채널 시뮬레이션을 활용하여 현실적인 네트워크 조건에서 알고리즘 성능 검증


## 1.4 What results were obtained?

- 제안된 RL 기반 RRS 성능
  - 기존 PF 및 RL 기반 방법들보다 우수한 슬라이스별 QoS 충족률 달성
  - 네트워크 트래픽 변화에 따라 자원 할당을 동적으로 조정
  - Intent Drift를 감지하고 교졍하여 네트워크 상태 변화에도 QoS 요구 유지
  - BE 슬라이스의 long-term average throughput 및 5-percentile throughput이 목표에 근접하게 유지

## 1.5 What is the significance of the results?

- 의도 기반 자원 스케쥴링의 유효성 입증
  - RAN 슬라이싱 환경에서 네트워크 성능을 극대화할 수 있음
- 결과의 주요 의의
  - 적응성: 실시간으로 네트워크 상태 변화에 따라 자율적 자원 할당 가능
  - 확장성: 다양한 슬라이스와 QoS 메트릭을 지웥하여 미래 네트워크에도 적용 가능
  - 미래 연구 및 응용: 공개된 코드와 프레임워크는 지능형 네트워크 자원 관리와 자율 네트워킹의 기초가 될 수 있음

---

# 2. Paper Summarization

## 2.1 Introduction

- **연구 배경**
  - 5G 및 차세대 네트워크에서는 다양한 서비스의 요구를함지원하기 위해 네트워크 슬라이싱이 핵심 기술로 자리 잡음
  - RAN 슬라이싱은 무선 주파수 자원과 같은 제한된 자원을 효율적으로 관리하여 각 슬라이스의 요구를 충족해야함
- **문제점**
  - 네트워크 슬라이스 간 무선 자원 스케쥴링은 다양한 SLA(Service Level Agreement)를 만족하는 것이 어려움
  - 네트워크 트래픽의 변동성과 슬라이스별 QoS 요구의 상이함으로 인해 자원 부족 상황에서 최적의 자원 배분이 복잡해짐
- **목표**
  - Intent-aware 자원 스케쥴링 프레임워크를 제안하여 슬라이스별 QoS 목표를 효과적으로 충족하고 자원 배분을 최적화하는 것을 목표로 함
    - 슬라이스의 QoS 요구를 SLA에 기반하여 정량적으로 표현
    - 강화학습을 사용하여 실시간 네트워크 상태 변화에 적응적 자원 할당 수행
    - Intent drift를 감지 및 교정하여 네트워크가 지속적으로 SLA 목표를 만족하도록 설계

## 2.2 Related Work

기존 연구는 RAN 슬라이싱 환경에서 Radio Resource Scheduling을 최적화하기 위해 다양한 최적화 기법과 기계 학습 기법을 제안함


### 2.2.1 Optimization-based Approaches

- Lyapunov 최적화
  - Lyapunov 최적화 방법은 네트워크의 불확실성을 고려하여 자원 스케쥴링 문제를 최적화함[14]
  - 장점: 이론적으로 안정성 보장
  - 단점: 복잡한 네트워크 환경에서 비선형성과 불확실성 처리에 한계

- Earliest Deadline First(EDF)
  - EDF 스케쥴링은 패킷 전송 시 마감 시간이 가장 짧은 요청을 우선적으로 처리하는 방법임[14]
  - 한계: 네트워크 요구가 동적으로 변화할 때는 비효율적일 수 있음
  
- Markov Decision Process(MDP)
  - MDP는 상태 전이 확률에 따라 최적의 결정을 내리도록 하는 기법으로 자원 할당 문제에 적용됨[15]
  - 한계: 상태 공간이 커지면 연산 복잡도가 급격히 증가함

- Supervised Learning
  - 네트워크의 과거 데이터를 바탕으로 자원 스케쥴링을 예측하는 방법[16]
  - 한계: 새로운 환경이나 변화하는 트래픽 패턴에 적응하기 어려움
  

### 2.2.2 Data-driven Approaches using Reinforcement Learning

- 강화 학습과 RAN 슬라이싱
  - RL은 네트워크 데이터를 기반으로 정책을 학습하여 자원 스케쥴링을 수행하며, 특히 5G 및 B5G 환경에서 유망한 방법으로 평가받고 있음

- 기존 강화 학습 기반 RRS 연구
  - [9]의 연구
    - 기법 
      - O-RAN 표준을 따르는 PPO(Proximal Policy Optimization) 기반의 강화 학습을 활용하여 슬라이스 간(inter-slice) 미 슬라이스 내(intra-slice) 자원 배분을 최적화함
    - 특징
      - eMBB, mMTC, URLLC 슬라이스를 고려
      - 보상함수는 eMBB의 데이터 전송률을 최대화하고, URLLC의 버퍼 크기를 최소화하는 방식으로 설계됨
    - 한계
      - 각 슬라이스의 세부 의도를 고려하지 않고, QoS 요구사항을 일반적인 네트워크 메트릭 최적화로 단순화함
  
  - [10]의 연구
    - 기법
      - LSTM 기반의 심층 학습과 A3C(Asynchronous Advantage Actor-Critic) 알고리즘을 결합하여 슬라이스별 자율적 자원 할당 수행
    - 특징
      - 각 슬라이스에 독립적인 RL 에이전트를 두어 유연한 자원 관리 가능
      - 자원이 부족할 경우 슬라이스 간 상호작용을 줄이도록 설계
    - 한계 
      - 자원이 충분하지 않은 경우 모든 슬라이스에 부정적 보상을 주어 수렴이 어려움

  - [11]의 연구
    - 기법
      - DDPG(Deep Deterministic Policy Gradient)와 DQN(Double Deep Q-Network)을 결합하여 슬라이스별 자원과 전력을 최소화하는 2단계 스케쥴러를 제안
    - 특징
      - 상위 레벨 컨트롤러가 각 슬라이스의 최대 및 최소 전송률을 설정하고, 하위 레벨 컨트롤러가 실제 자원 할당을 수행
      - 슬라이스별 QoS 성능을 고려한 가중치 기반의 보상 함수를 사용함
    - 한계
      - 슬라이스 간 우선순위를 명시적으로 설정하지 않으며, 네트워크 요구가 변할 경우 적응이 어려움
    
  - [12], [13]의 연구
    - 기법
      - SLA 만족률을 기반으로 자원 배분을 최적화하는 방법을 제안
    - 특징
      - [12]는 LSTM과 A2C(Advantage Actor-Critic) 알고리즘을 결합하여 슬라이스 대역폭을 동적으로 할당
      - [13]은 Ape-X 기반의 분산형 심층 강화 학습을 사용하여 Resource Block 할당을 최적화
    - 한계
      - 슬라이스 간의 우선순위 설정이 명확하지 않으며, QoS 목표의 세부적인 정량적 측정이 부족함

#### 2.2.3 기존 연구의 한계와 문제점

1. 슬라이스별 Intent aware 접근 부족
   - 기존 연구는 슬라이스의 QoS 목표를 정량적 의도로 구체적으로 정의하지 못함[9, 10, 11] 
   - 각 슬라이스의 목표가 명확하지 않으므로, 특정 메트릭의 최적화가 실제로 의도를 충족하는지 판단하기 어려움
2. 보상 함수의 설계 문제
   - 보상 함수가 특정 네트워크 메트릭만을 최적화하는 데 중점을 둬, intent drift를 인지하거나 교정하지 못함[9, 10, 11, 13] 
3. 슬라이스 간 우선순위 미고려
   - 일부 연구에서는 슬라이스 간 자원 경쟁 시 우선순위를 명확히 설정하지 않아 중요한 슬라이스의 요구를 충족하지 못할 수 있음[11]
4. 슬라이스별 상이한 메트릭 고려 부족
   - 모든 슬라이스에 동일한 메트릭을 적용하거나 제한적인 메트릭만 고려하여 다양한 네트워크 시나리오에서 확장성이 부족함[9, 10, 11]


#### 2.2.4 본 논문의 contribution

1. Intent 기반 RRS 설계
  - 본 논문은 각 슬라이스의 의도를 명확히 정의하고, 이를 QoS 목표로 변환하여 보상 함수에 반영
2. Intent drift 감지 및 교정
  - 네트워크 상태가 변화할 때 의도 드리프트를 자동으로 인지하고 보상 함수를 통해 이를 교정하공 메커니즘을 제공
3. 슬라이스 간 우선순위 설정
   - 가중치를 부여하여 중요한 슬라이스에 자원을 우선적으로 배정하며, 부족한 자원 상황에서도 QoS 목표를 최대한 충족할 수 있도록 설계
4. 다양한 메트릭 지원
   - eMBB, URLLC, BE와 같은 다양한 슬라이스 타입에 맞춤형 메트릭을 적용하여 확장성이 높은 RRS를 제공
  
### 2.3 Communication System Model and Problem Formulation

#### 2.3.1 통신 시스템 모델

- 대규모 밀리미터파 MIMO 시스템
  - $$ C = \{1, 2, ..., C\}$$개의 셀로 구성된 네트워크를 가정하고, 타겟 셀($$C_{target}$$)에서 분석을 수행
  - 송신 안테나 수: $$N_t$$, 수신 안테나 수: $$N_u$$
  - 대역폭 $$ B MHz$$로 나뉘어진 주파수 자원은 Resource Block으로 세분화되며, 이를 Resource Block Group으로 묶어 관리함
- 슬라이스 구조
  - 각 셀은 $$S={1, 2, ..., S}$$개의 슬라이스를 가짐
  - 각 슬라이스 $$s$$는 동일한 QoS 요구를 가진 UE $$U_s = \{1, 2, ..., U_s\}$$로 구성됨
- 시간 단위
  - 스케쥴링은 최소 시간 단위인 TTI $$t$$에 따라 수행되며 $$t_n = t \times n$$은 스텝 $$n$$에서의 시간값을 의미

#### 2.3.2 네트워크 메트릭 정의

- RSRP
  
$$ RSRP_{b, u} = PL SF |\alpha_{0}|^2 |

---

# 3. Take Away

- 시뮬레이션 파라미터들을 참고하여 NS-3에서 사용
- 10 p.m. - 6 a.m. 까지 사용자를 고정시킨 후 cell on/off를 실행
- 예측 알고리즘과 on/off 알고리즘의 결합
