---
layout: post
title: 오프로딩 시뮬레이터 - Collector 
description: >
  **Date**: 2024.12.27, 
  **Tag**: [Offloading], [Patent], [Multi Frequency Band]
image: 
  path: /assets/img/blog/sim/phase1/sim.png
  srcset: 
    1920w: /assets/img/blog/sim/phase1/sim.png
    960w:  /assets/img/blog/sim/phase1/sim@0,5x.png
    480w:  /assets/img/blog/sim/phase1/sim@0,25x.png
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
---

<!--more-->

* toc
{:toc .large-only}

# 5G 셀 시뮬레이터 구현 가이드: `traffic/collectors/frequency_collector.py`

## 1. 아키텍쳐 개요

### 1.1 핵심 구조 
- 추상 기본 클래스(BaseCollector)를 중심으로 한 계층적 설계
- 구체적인 수집기들이 BaseCollector를 상속받아 구현
- 모듈식 구조로 새로운 수집기 타입 확장 용이

### 1.2 주요 컴포넌트
- BaseCollector: 데이터 수집의 기본 프레임워크 제공
    - 공통 속성 및 메서드 정의
    - 데이터 버퍼링 메커니즘 구현
    - 수집 주기 관리 기능

- FrequencyCollector: 주파수 관련 데이터 수집 담당
    - Resource Block 사용률 모니터링
    - UE 연결 상태 추적
    - 처리량 계산 및 기록

### 1.3 데이터 흐름
- 실시간 데이터 수집 $\rightarrow$ 임시 버퍼 저장 $\rightarrow$ 구조화된 데이터 형태로 변환 
- 시계열 데이터 형식으로 타임스탬프 정보 포함
- 주기적인 데이터 수집 및 저장 보장

## 2. 코드 설명

### 2.1 BaseCollector 클래스
``` python
class BaseCollector(ABC):
    def __init__(self, sampling_interval=1.0):
        self.sampling_interval = sampling_interval
        self.last_collection_time = None
        self._buffer = []
```

- 초기화 부분은 데이터 수집의 기본 설정을 담당
- `sampling_interval`: 데이터 수집 주기 설정 (기본값 10초)
- `last_collection_time`: 마지막 데이터 수집 시간 추적
- `_buffer`: 수집된 데이터를 임시 저장하는 리스트


``` python
def buffer_data(self, data):
    timestamp = datetime.now()
    self._buffer.append((timestamp, data))
```

- 수집된 데이터를 타임스탬프와 함께 버퍼에 저장
- 데이터의 시간 순서를 보장하고 추후 분석을 위한 시계열 데이터 구조 생성


### 2.2 FrequencyCollector 클래스

``` python
class FrequencyCollector(BaseCollector):
    def __init__(self, cell, sampling_interval=1.0):
        super().__init__(sampling_interval)
        self.cell = cell
        self.frequencies = cell.freq_config.keys()
```

- BaseCollector를 상속받아 주파수별 데이터 수집에 특화된 기능 구현
- `cell`: 데이터를 수집할 셀 객체
- `frequencies`: 모니터링할 주파수 대역 목록

``` python
def collect(self):
    traffic_data = {}
    for freq in self.frequencies:
        if self.cell.freq_config[freq]['active']:
            rb_usage = self.cell.get_frequency_load(freq)
            connected_ues = len(self.cell.get_frequency_users(freq))
            throughput = self.calculate_frequency_throughput(freq)
            
            traffic_data[freq] = {
                'rb_usage': rb_usage,
                'connected_ues': connected_ues,
                'throughput': throughput
            }
```
  
- 각 활성화된 주파수 대역에 대해 다음 데이터를 수집:
  1. Resource Block 사용률
  2. 연결된 UE 수
  3. 총 처리량
- 수집된 데이터는 주파수별로 구조화되어 저장

``` python
def calculate_frequency_throughput(self, freq):
    total_throughput = 0
    for ue_id in self.cell.get_frequency_users(freq):
        ue_throughput = self.cell.get_UE_throughput(ue_id)
        if ue_throughput is not None:
            total_throughput += ue_throughput
    return total_throughput
```

- 특정 주파수 대역의 총 처리량 계산
- 해당 주파수를 사용하는 모든 UE의 처리량을 합산
- None 값 처리를 통한 안정성 보장
