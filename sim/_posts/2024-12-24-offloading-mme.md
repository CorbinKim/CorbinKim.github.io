---
layout: post
title: 오프로딩 시뮬레이터 - MME
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


# 5G 셀 시뮬레이터 구현 가이드: `ue.py`

## 1. 아키텍쳐 개요

MME(Mobility Management Entity)는 5G 네트워크의 핵심 구성 요소로, 사용자 장비(UE)의 이동성과 연결성을 관리하는 중요한 역할을 담당함. 본 시뮬레이터에서 구현한 MME는 다음과 같은 주요 기능을 제공함

- UE의 핸드오버 관리
- 셀 간 이동성 최적화
- 핸드오버 이력 추적 및 분석
- 핑퐁 효과 방지
- QoS(Quality of Service) 보장

## 2. 코드 설명

### 1. 클래스 초기화
```python
def __init__(self, sim, interval=10.0, 
             strategy='strongest_cell_simple_pathloss_model',
             anti_pingpong=30.0, verbosity=0):
    self.sim = sim
    self.interval = interval
    self.strategy = strategy
    self.anti_pingpong = anti_pingpong
    self.verbosity = verbosity
    self.handover_history = {}
```

- sim: 시뮬레이터 인스턴스를 참조하여 전체 네트워크 상태에 접근
- interval: 핸드오버 체크 주기를 결정(기본값 10초)
- strategy: 핸드오버 결정 전략 선택
- anti_pingpong: 핑퐁 현상 방지를 위한 시간 간격
- handover_history: UE별 핸드오버 이력 저장용 딕셔너리



### 2. 핸드오버 실행 로직
```python
def do_handovers(self):
    for ue in self.sim.U직s:
        current_cell = ue.get_serving_cell()
        if current_cell is None:
            continue
            
        target_cell_i = self.sim.get_strongest_cell_simple_pathloss_model(ue.xyz)
        if target_cell_i is None:
            continue
            
        target_cell = self.sim.cells[target_cell_i]
        
        if target_cell.i != current_cell.i:
            if self.check_pingpong(ue.i, current_cell.i, target_cell.i):
                continue
                
            if not self.check_target_cell_quality(target_cell, ue):
                continue
                
            self.execute_handover(ue, current_cell, target_cell)
```

- 모든 UE에 대해 주기적으로 핸드오버 필요성 검사
- 현재 셀과 잠재적 타겟 셀의 신호 강도 비교
- 핑퐁 현상 방지를 위한 검증 수행
- 타겟 셀의 QoS 제공 능력 확인
- 모든 조건 만족 시 핸드오버 실행


### 3. 핑퐁 방지 메커니즘
```python
def check_pingpong(self, ue_id, current_cell_i, target_cell_i):
    if self.anti_pingpong <= 0:
        return False
            
    if ue_id not in self.handover_history:
        return False
            
    history = self.handover_history[ue_id]
    if not history:
        return False
            
    last_time, from_cell, to_cell = history[-1]
    current_time = self.sim.env.now
        
    if (current_time - last_time < self.anti_pingpong and
        ((from_cell == target_cell_i and to_cell == current_cell_i) or
         (from_cell == current_cell_i and to_cell == target_cell_i))):
        return True
            
    return False
```

- 최근 핸드오버 이력 확인
- anti_pingpong 시간 내의 역방향 핸드오버 방지
- UE별 개별 이력 관리
- 시간 기반의 핑퐁 방지 로직 구현


### 4. QoS 검증

```python
def check_target_cell_quality(self, target_cell, ue):
    target_rsrp = target_cell.get_rsrp(ue.i)
    if target_rsrp < -110:  # -110 dBm 임계값
        return False
            
    for freq in target_cell.freq_config:
        if (target_cell.freq_config[freq]['active'] and 
            target_cell.get_frequency_load(freq) < 0.9):
            return True
                
    return False
```

- 타겟 셀의 RSRP(Reference Signal Received Power) 검사
- 주파수별 부하 상태 확인
- QoS 임계값 기반 검증
- 리소스 가용성 확인

### 5. 핸드오버 실행 및 기록

```python
def execute_handover(self, ue, source_cell, target_cell):
    if self.verbosity > 0:
        print(f'Handover UE[{ue.i}] from Cell[{source_cell.i}] to Cell[{target_cell.i}]',
              file=stderr)
            
    ue.detach()
    ue.attach(target_cell)
        
    if ue.i not in self.handover_history:
        self.handover_history[ue.i] = deque(maxlen=10)
    self.handover_history[ue.i].append(
        (self.sim.env.now, source_cell.i, target_cell.i)
    )
```

- UE의 현재 셀 연결 해제
- 새로운 셀에 UE 연결
- 핸드오버 이력 기록
- 디버깅 정보 출력 (verbosity 설정 시)
석
### 6. 통계 및 분석

``` python
def get_handover_stats(self):
    stats = {}
    for ue_id, history in self.handover_history.items():
        stats[ue_id] = {
            'total_handovers': len(history),
            'last_handover_time': history[-1][0] if history else None,
            'frequent_transitions': self.get_frequent_transitions(history)
        }
    return stats
```

- UE별 총 핸드오버 횟수 집계
- 마지막 핸드오버 시간 기록
- 빈번한 전환 패턴 분석
- 네트워크 최적화를 위한 통계 데이터 제공
