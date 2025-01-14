---
layout: post
title: 오프로딩 시뮬레이터 - Pathloss 
description: >
  **Date**: 2024.12.26, 
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

# 5G 셀 시뮬레이터 구현 가이드: `utils/pathloss.py`

## 1. 아키텍쳐 개요

- 3GPP 표준에 정의된 경로손실 모델 구현
- 주파수 대역별 최적 모델 선택
- 도시 환경(Urban Macro/Micro) 지원
- LOS/NLOS 시나리오 고려
- 정확한 전파 특성 예측

## 2. 코드 설명 

```python
def __init__(self, sim, interval=1, xyz=None, h_BS=20.0, 
             MIMO_gain_dB=0.0, pattern=None, f_callback=None, 
             f_callback_kwargs={}, verbosity=0):
    self.i = Cell.i
    Cell.i += 1
    self.sim = sim
    self.interval = interval
    
    # 트래픽 예측 관련 설정
    self.traffic_predictor = ProphetPredictor()
    self.traffic_db = TimeseriesDB()
    self.prediction_horizon = 10  # 10초 (1초 * 10)
```

- `sim`: 메인 시뮬레이터 인스턴스를 전달받음. 이를 통해 전체 시뮬레이션 환경에 접근할 수 있음
- `interval`: 셀의 상태 업데이트 주기를 설정. 기본값은 1초
- `traffic_predictor`: 트래픽 예측기를 초기화
- `prediction_horizon`: 10으로 설정하여 10초 앞의 트래픽을 예측

중요 포인트
{:.note}
- Cell.i는 셀 식별자로 사용되며, 생성될 때마다 자동으로 증가한다.
- ProphetPredictor는 별도의 클래스로 구현되어 있으며, 시계열 예측을 담당한다.


#### 2. 주파수 설정
``` python
# 주파수 설정
self.freq_config = {
    800: {
        'bandwidth': 10.0,  # MHz
        'n_RBs': 50,       # Resource Blocks
        'active': False,
        'energy_consumed': 0.0
    },
    1800: {
        'bandwidth': 20.0,
        'n_RBs': 100,
        'active': False,
        'energy_consumed': 0.0
    },
    3600: {
        'bandwidth': 100.0,
        'n_RBs': 500,
        'active': False,
        'energy_consumed': 0.0
    }
}
```

- 각 주파수 대역별로 다음 파라미터를 설정
  - `bandwidth`: MHz
  - `n_RBs`: Resource Block 수
  - `active`: 활성화 여부
  - `energy_consumed`: 에너지 소비량
  
중요 포인트
{:.note}
- 800MHz: 커버리지가 넓지만 용량이 적음
- 1800MHz: 중간 대역으로 커버리지와 용량의 균형을 제공
- 3600MHz: mmWave 대역으로 높은 용량을 제공하지만 커버리지가 제한적


#### 3. 트래픽 예측
``` python
def predict_traffic(self, freq):
    if len(self.traffic_history[freq]) < 10:  # 최소 10초의 데이터 필요
        return None
        
    data = pd.DataFrame({
        'ds': pd.date_range(end=pd.Timestamp.now(), 
                          periods=len(self.traffic_history[freq]), 
                          freq='15T'),
        'y': self.traffic_history[freq]
    })
    
    self.traffic_predictor.train(data)
    forecast = self.traffic_predictor.predict(self.prediction_horizon)
    return forecast['yhat'].values[-1]
```

- `traffic_history`: 각 주파수별 트래픽 이력을 저장
- 최소 10초(10개의 샘플)의 데이터가 필요
- Prophet 모델의 입력 형식에 맞게 DataFrame을 구성
- 예측 결과의 마지막 값을 반환

중요 포인트
{:.note}
- Prophet 모델은 `ds`와 `y` 컬럼을 필요로 함
- 10초 간격으로 데이터를 샘플링
- 예측값이 없는 경우 None을 반환

#### 4. 에너지 소비 관리

``` python
def update_energy_consumption(self):
    interval_hours = self.interval / 3600  # 초를 시간으로 변환
    energy = self.base_power_W * interval_hours
    
    for freq in self.freq_config:
        if self.freq_config[freq]['active']:
            freq_energy = self.frequency_power_W * interval_hours
            self.freq_config[freq]['energy_consumed'] += freq_energy
            energy += freq_energy
            
    self.total_energy_consumed += energy
```
- 기본 전력 소비(`base_power_W`)와 주파수별 추가 전력 소비를 계산
- 시간 단위로 변환하여 에너지 소비량을 계산
- 각 주파수 대역별 에너지 소비를 누적하여 기록

중요 포인트
{:.note}
- `interval_hours`: 초 단위를 시간 단위로 변환
- `base_power_W`: 기본 소비 전력 (130W)
- `frequency_power_W`: 주파수 당 추가 소비 전력 (100W)


#### 5. 셀 상태 관리

``` python
def manage_cell_state(self):
    for freq in self.freq_config:
        if not self.freq_config[freq]['active']:
            continue
            
        current_load = self.get_frequency_load(freq)
        predicted_load = self.predict_traffic(freq)
        
        if predicted_load is None:
            continue
            
        if (current_load < self.traffic_thresholds[freq]['low'] and 
            predicted_load < self.traffic_thresholds[freq]['low']):
            if self.can_shift_traffic(freq):
                self.deactivate_frequency(freq)
                self.redistribute_traffic(freq)
        elif (current_load > self.traffic_thresholds[freq]['high'] or 
              predicted_load > self.traffic_thresholds[freq]['high']):
            self.activate_frequency(freq)
```

- 각 주파수 대역의 현재 부하와 예측 부하를 확인
- 트래픽 임계값을 기준으로 주파수 활성화/비활성화를 결정
- 트래픽 재분배 가능 여부를 확인 후 실행

{:.note}
- `traffic_thresholds`: 주파수별 저부하/고부하 임계값
- `can_shift_traffic`: 트래픽 재분배 가능 여부를 확인하고, 분배 가능 여부을 반환
- `redistribute_traffic`: 실제 트래픽 재분배를 수행

#### 6. 성능 측정 및 보고

``` python
def get_metrics(self):
    return {
        'throughput': {
            'current': self.metrics['throughput'][-1] if self.metrics['throughput'] else 0,
            'average': np.mean(self.metrics['throughput']) if self.metrics['throughput'] else 0
        },
        'energy': self.get_energy_stats(),
        'load': {
            freq: self.get_frequency_load(freq)
            for freq in self.freq_config
        }
    }
```

- 처리량, 에너지 소비, 부하 등의 주요 성능 지표를 수집
- 현재값과 평균값을 함께 제공
- 주파수별 세부 통계를 포함

중요 포인트
{:.note}
- 처리량은 가장 최근값과 평균값을 제공
- 에너지 통계는 총 소비량과 주파수별 소비량 포함
- 부하는 각 주파수 대역별로 계산


#### 7. 참고문헌
1. Path Loss Models: 3GPP TR 38.901
2. QoS 관리: 3GPP TS 23.501
3. 주파수 자원 관리: TS 38.211