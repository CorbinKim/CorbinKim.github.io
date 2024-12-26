---
layout: post
title: 오프로딩 시뮬레이터 - RIC
description: >
  **Date**: 2024.12.24, 
  **Tag**: [Offloading], [Patent], [Multi Frequency Band]
image: 
  path: /assets/img/blog/green_ai/green-ai.png 
  srcset: 
    1920w: /assets/img/blog/green_ai/green-ai.png
    960w:  /assets/img/blog/green_ai/green-ai@0,5x.png
    480w:  /assets/img/blog/green_ai/green-ai@0,25x.png
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
---

<!--more-->

* toc
{:toc .large-only}


# 5G 셀 시뮬레이터 구현 가이드: `components/ric.py`

## 아키텍쳐 개요

RIC.py는 강화학습을 위한 경험 수집기(Experience Collector) 역할을 한다. 이 모듈은 다음과 같은 주요 컴포넌트들로 구성되어 있다.

- **Storage Manager**: 경험 데이터의 저장과 관리를 담당하는 컴포넌트
- **Experience Collector**: 에이전트의 행동과 환경으로부터의 피드백을 수집하는 핵심 컴포넌트
- **Priority Calculator**: 경험의 중요도를 계산하고 우선수위를 결정하는 컴포넌트
- **Batch Generator**: 학습을 위한 미니배치를 생성하는 컴포넌트

## 코드 설명

### 1. Storage Manager
``` python
class StorageManager:
    def __init__(self, capacity):
        self.capacity = capacity
        self.memory = []
        self.position = 0
        
    def push(self, experience):
        if len(self.memory) < self.capacity:
            self.memory.append(None)
        self.memory[self.position] = experience
        self.position = (self.position + 1) % self.capacity
        
    def sample(self, batch_size):
        return random.sample(self.memory, batch_size)
```
- `__init__`: 저장소 초기화
  - capacity 파라미터로 최대 저장 용량을 설정
  - memory 리스트로 실제 경험 데이터를 저장
  - position은 circular buffer에서 현재 위치를 추적 

- `push`: 새로운 경험 저장
  - 용량이 남아있으면 새로운 공간 할당
  - circular buffer 방식으로 오래된 데이터를 새로운 데이터로 대체
  - position을 순환적으로 업데이트

- `sample`: 배치 샘플링
    - random.sample을 사용하여 무작위로 배치 크기만큼의 경험을 추출
    - 중복 없는 샘플링 보장

### 2. Experience Collector
``` python
class ExperienceCollector:
    def __init__(self, storage_manager):
        self.storage = storage_manager
        self.current_episode = []
        
    def add_experience(self, state, action, reward, next_state, done):
        experience = (state, action, reward, next_state, done)
        self.current_episode.append(experience)
        
    def episode_end(self):
        for exp in self.current_episode:
            self.storage.push(exp)
        self.current_episode = []
```

- `__init__`: 컬렉터 초기화
    - storage_manager 참조를 저장
    - current_episode 리스트로 현재 에피소드의 경험을 임시 저장

- `add_experience`: 새로운 경험 추가
    - state, action, reward, next_state, done 정보를 튜플로 패키징
    - 현재 에피소드 리스트에 임시 저장
    - 메모리 효율을 위해 numpy 배열 사용 권장

- `episode_end`: 에피소드 종료 처리
    - 현재 에피소드의 모든 경험을 storage에 저장
    - current_episode 리스트 초기화
  

### 3. Priority Calculator
``` python
class PriorityCalculator:
    def __init__(self, alpha=0.6, beta=0.4):
        self.alpha = alpha
        self.beta = beta
        self.priorities = []
        
    def update_priorities(self, indices, errors):
        for idx, error in zip(indices, errors):
            priority = (abs(error) + 1e-5) ** self.alpha
            self.priorities[idx] = priority
            
    def get_sampling_probabilities(self):
        probs = np.array(self.priorities) ** self.alpha
        probs = probs / sum(probs)
        return probs
```

- `__init__`: 우선순위 계산기 초기화
  - alpha: 우선숭뉘 계산에 사용되는 지수 파라미터
  - beta: 중요도 샘플링 보정에 사용되는 파라미터
  - priorities: 각 경험의 우선순위를 저장하는 리스트

- `update_priorities`: 우선순위 업데이트
  - TD-error를 기반으로 우선순위 계산
  - 작은 상수를 더해 0 우선순위 방지
  - alpha 파라미터로 우선순위 스케일 조정

- `get_sampling_probabilities`: 샘플링 확률 계산
  - 우선순위를 확률로 변환
  - 전체 합이 1이 되도록 정규화
  - numpy 배열 사용으로 계산 효율성 확보


### 4. Batch Generator

``` python
class BatchGenerator:
    def __init__(self, storage_manager, priority_calculator, batch_size):
        self.storage = storage_manager
        self.priority_calc = priority_calculator
        self.batch_size = batch_size
        
    def generate_batch(self):
        probss = self.priority_calc.get_sampling_probabilities()
        indices = np.random.choice(
            len(self.storage.memory),
            self.batch_size,
            p=probs
        )
        experiences = [self.storage.memory[idx] for idx in indices]
        return experiences, indices
```

- `__init__`: 배치 생성기 초기화
    - storage_manager: 경험 저장소 참조
    - priority_calculator: 우선순위 계산기 참조
    - batch_size: 생성할 배치의 크기

- `generate_batch`: 배치 생성
  - 우선순위 기반 확률 계산
  - numpy.random.choice로 우선순위에 따른 샘플링
  - 선택된 인덱스의 경험들을 배치로 구성
  - 인덱스도 함께 반환하여 우선순위 업데이트 가능