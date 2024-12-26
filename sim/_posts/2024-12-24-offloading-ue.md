---
layout: post
title: 오프로딩 시뮬레이터 - UE.py
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

### 1.1 설계 철학
- **3GPP 표준 준수**: 실제 5G UE의 동작을 충실히 반영하여 시뮬레이션의 현실성을 보장한다. 특히 핸드오버, QoS 관리, 무선 환경 측정 등에서 표준 기반 구현을 중요시한다.
- **모듈화된 구조**: 이동성, 트래픽 생성, 성능 모니터링 등의 기능을 독립적인 모듈로 분리하여 유지보수성과 확장성을 높인다.
- **효율적인 상태 관리**: 시뮬레이션의 안정성을 위해 UE의 상태(위치, 연결, 성능 지표 등)를 일관되고 효율적으로 관리한다.
- **데이터 중심 설계**: 성능 분석과 최적화를 위해 필요한 모든 메트릭을 체계적으로 수집하고 관리한다.
- **자원 효율성**: 대규모 시뮬레이션을 고려하여 메모리 사용과 연산 비용을 최적화한다.

#### 1. 클래스 초기화
```python
def __init__(self, sim, i: int, xyz: np.ndarray,
             movement_pattern: Optional[Dict] = None,
             traffic_pattern: Optional[Dict] = None,
             service_requirements: Optional[Dict] = None):
    self.sim = sim
    self.i = i
    self.xyz = np.array(xyz)
    
    # 이동성 설정
    self.movement_pattern = movement_pattern or {
        'type': 'random_walk',
        'velocity': 1.0,  # m/s
        'direction_change_interval': 30.0  # 초
    }
    
    # 트래픽 설정
    self.traffic_pattern = traffic_pattern or {
        'type': 'constant',
        'data_rate': 1.0  # Mbps
    }
    
    # QoS 요구사항
    self.service_requirements = service_requirements or {
        'min_throughput': 1.0,  # Mbps
        'max_latency': 100.0    # ms
    }
```
- `sim`: 시뮬레이터 인스턴스 참조
- `i`: UE 식별자
- `xyz`: 3차원 공간에서의 초기 위치
- `movement_pattern`: 이동 패턴 (기본값: random walk)
- `traffic_pattern`: 트래픽 생성 패턴 (기본값: constant rate)
- `service_requirements`: QoS 요구사항(throughput, latency 등)

#### 2. 트래픽 생성기 초기화
```python
def initialize_traffic_generator(self):
    """트래픽 생성기 초기화"""
    if self.traffic_pattern['type'] == 'constant':
        self.generate_traffic = self._generate_constant_traffic
    elif self.traffic_pattern['type'] == 'poisson':
        self.generate_traffic = self._generate_poisson_traffic
    elif self.traffic_pattern['type'] == 'bursty':
        self.generate_traffic = self._generate_bursty_traffic
    else:
        raise ValueError(f"Unknown traffic pattern: {self.traffic_pattern['type']}")
```
- 패턴 타입에 따라 적절한 생성 함수가 동적으로 할당됨
- 지원되지 않는 패턴 타입 사용시 `ValueError` 발생
- 패턴 변경 시 반드시 이 method를 다시 호출해야 함


#### 3. 위치 업데이트 메커니즘
```python
def update_position(self):
    """위치 업데이트"""
    current_time = self.sim.env.now
    
    # 방향 변경 체크
    if (current_time - self.last_direction_change > 
        self.movement_pattern['direction_change_interval']):
        self.update_direction()
        self.last_direction_change = current_time
    
    # 속도 계산
    self.velocity = self.direction * self.movement_pattern['velocity']
    
    # 위치 업데이트
    self.xyz += self.velocity * self.sim.interval
    
    # 시뮬레이션 영역 내 제한
    self.xyz = np.clip(self.xyz, 
                      self.sim.area_bounds[0], 
                      self.sim.area_bounds[1])
```
- 방향 변경은 설정된 간격마다 수행
- 속도는 방향 벡터와 설정된 속도값의 곱으로 계산
- 시뮬레이션 영역을 벗어나지 않도록 위치를 제한
- `sim.interval`을 통해 시뮬레이션 시간 스텝 반영


#### 4. 무선 환경 측정
```python
def measure_radio_conditions(self):
    """무선 환경 측정"""
    current_time = self.sim.env.now
    if current_time - self.last_measurement < self.measurement_interval:
        return
    
    self.last_measurement = current_time
    
    # 모든 셀에 대한 RSRP 측정
    best_rsrp = float('-inf')
    best_cell = None
    
    for cell in self.sim.cells:
        for freq in cell.freq_config:
            if not cell.freq_config[freq]['active']:
                continue
            
            rsrp = cell.get_rsrp(self.i, freq)
            if rsrp > best_rsrp:
                best_rsrp = rsrp
                best_cell = cell
```

- 측정은 설정된 간격(`meaurement_interval`)마다 수행
- 활성화된 주파수에 대해서만 RSRP 측정
- 최적의 셀 선택을 위해 모든 가능한 셀과 주파수 조합 검사
- RSRP 값이 가장 높은 셀을 최적 셀로 선정

#### 5. SINR 계산
```python
def calculate_sinr(self) -> float:
    """SINR 계산"""
    if not self.serving_cell:
        return float('-inf')
    
    # 서빙 셀로부터의 신호 전력
    serving_power = 10**(self.serving_cell.get_rsrp(self.i)/10)
    
    # 간섭 전력 계산
    interference = 0
    for cell in self.sim.cells:
        if cell != self.serving_cell:
            interference += 10**(cell.get_rsrp(self.i)/10)
    
    # 노이즈 파워 (-174 dBm/Hz + 대역폭)
    noise_power = 10**(-174/10) * self.serving_cell.bandwidth
    
    # SINR 계산
    sinr = serving_power / (interference + noise_power)
    return 10 * np.log10(sinr)
```
- dBm 단위의 RSRP를 선형 전력값으로 변환하여 계산
- 모든 non-serving 셀로부터의 간섭을 고려
- 열잡음 전력은 -174dBm/Hz를 기준으로 대역폭 고려
- 최종 결과는 dB 단위로 반환

#### 6. QoS 만족도 평가
``` python
def get_qos_satisfaction(self) -> Dict[str, bool]:
    """QoS 만족도 확인"""
    if not self.metrics['throughput'] or not self.metrics['latency']:
        return {'throughput': False, 'latency': False}
    
    avg_throughput = np.mean(self.metrics['throughput'])
    avg_latency = np.mean(self.metrics['latency'])
    
    return {
        'throughput': avg_throughput >= self.service_requirements['min_throughput'],
        'latency': avg_latency <= self.service_requirements['max_latency']
    }
```
- 측정된 메트릭이 없는 경우 모든 항목 불만족으로 처리
- Throughput과 latency에 대해 평균값 기준으로 평가
- 설정된 요구사항과 비교하여 만족 여부 판단
- Boolean 값으로 각 항목의 만족 여부 반환

#### 7. 메인 루프
``` python
def loop(self):
    """메인 루프"""
    while True:
        yield self.sim.wait(self.sim.interval)
        
        # 위치 업데이트
        self.update_position()
        
        # 무선 환경 측정
        self.measure_radio_conditions()
        
        # 성능 메트릭 업데이트
        self.update_metrics()
```

- SimPy 환경에서 동작하는 Generator 함수로 구현
- 시뮬레이터의 시간 간격에 따라 주기적으로 실행
- 위치, 무선 환경, 성능 메트릭을 순차적으로 업데이트
- 무한 루프로 구현되어 시뮬레이션 종료까지 계속 실행

#### 8. 참고 문헌
- 3GPP TS 38.133: "NR; Reqeuirements for Support of Radio Resource Management"
- 3GPP TR 38.901: "Study on Channel Model for Frequents from 0.5 to 100 GHz"
- 3GPP TS 38.300: "NR; Overall description; Stage-2" 