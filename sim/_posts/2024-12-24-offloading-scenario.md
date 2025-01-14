---
layout: post
title: 오프로딩 시뮬레이터 - Scenario
description: >
  **Date**: 2024.12.24, 
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

<<<<<<< HEAD
# 5G 셀 시뮬레이터 구현 가이드: `scenario.py`
=======
# 5G 셀 시뮬레이터 구현 가이드: `components/scenario.py`
>>>>>>> c9b4b85b73d42fdc5a945dcab7b288650d40921f

## 아키텍쳐 개요
Scenario 모듈은 시뮬레이션 시나리오의 생성, 관리 및 실행을 담당함. 이 모듈은 두 개의 중 데이터 클래스(UEConfig, CellConfig)와 하나의 메인 클래스(Scenario)로 구성되어 있으며, YAML 또는 Json 형식의 설정 파일을 통해 시나리오를 정의하고 관리한다.

## 코드 설명

### 1. 데이터 클래스
``` python
@dataclass
class UEConfig:
    initial_positions: np.ndarray
    movement_patterns: Dict[str, Dict]
    traffic_patterns: Dict[str, Dict]
    service_requirements: Dict[str, float]

@dataclass
class CellConfig:
    positions: np.ndarray
    frequencies: Dict[str, Dict]
    coverage_patterns: Dict[str, Dict]
    power_configs: Dict[str, float]
```
- UEConfig
  - `initial_positions`: UE의 초기 위치를 (N, 3) 형태의 NumPy 배열로 저장
  - `movement_patterns`: 각 UE의 이동 패턴을 정의(예: 랜덤 워크, 정해진 경로 등)
  - `traffic_patterns`: UE별 트래픽 생성 패턴 정의(예: 일정 속도, 포아송 분포 등)
  - `service_requirements`: 처리량, 지연시간 등 QoS 요구사항 정의

- CellConfig
  - `positions`: 기지국들의 위치를 (M, 3) 형태의 NumPy 배열로 저장
  - `frequencies`: 각 셀의 주파수 대역 설정 (대역폭, RB 수 등)
  - `coverage_patterns`: 셀 커버리지 패턴 정의 (섹터, 옴니 등)
  - `power_configs`: 송신 전력 관련 설정 저장

### 2. 시나리오 클래스 초기화
``` python
def __init__(self, name: str, duration: float, config_path: Optional[str] = None):
    self.name = name
    self.duration = duration
    self.config_path = Path(config_path) if config_path else None
    
    # 기본 설정
    self.ue_config = None
    self.cell_config = None
    self.network_params = {}
    self.events = []
```

- `name`: 시나리오의 식별자 역할
- `duration`: 시뮬레이션 실행 시간 (초 단위)
- `config_path`: 설정 파일의 경로

### 3. 설정 파일 처리
``` python
def load_config(self):
        """설정 파일 로드"""
        if not self.config_path.suffix == '.json':
            raise ValueError("Only .json config files are supported")
            
        with open(self.config_path) as f:
            config = json.load(f)
            
        self._parse_config(config)
```
- JSON 형식의 config 파일 지원
- 지원하지 않는 형식에 대한 예외 처리

### 4. 설정 검증
``` python
def validate(self) -> bool:
        """시나리오 유효성 검증"""
        try:
            if not self.ue_configs:
                raise ValueError("No UE configurations")
                
            if self.cell_config is None:
                raise ValueError("No cell configuration")
            
            # UE 위치 검증
            for ue_cfg in self.ue_configs:
                if np.any(ue_cfg.initial_positions < 0) or \
                   np.any(ue_cfg.initial_positions[:,:2] > self.area_size):
                    raise ValueError("UE positions out of bounds")
            
                # 서비스 타입 검증
                if ue_cfg.service_type not in self.default_service_requirements:
                    raise ValueError(f"Invalid service type: {ue_cfg.service_type}")
            
            # 셀 위치 검증
            if np.any(self.cell_config.positions < 0) or \
               np.any(self.cell_config.positions[:,:2] > self.area_size):
                raise ValueError("Cell positions out of bounds")
            
            # 이벤트 시간 검증
            for event in self.events:
                if event.time < 0 or event.time > self.duration:
                    raise ValueError(f"Event time {event.time} out of range")
            
            return True
            
        except Exception as e:
            print(f"Scenario validation failed: {str(e)}")
            return False
```

- 필수 설정 요소들의 존재 여부 확인
- 데이터 형식과 값의 유효성 검사
- 시간 범위를 벗어난 이벤트 감지
- 오류 발생 시 상세한 메세지 제공


### 5. 이벤트 관리
``` python
def add_event(self, time: float, event_type: str, params: Dict):
    self.events.append({
        'time': time,
        'type': event_type,
        'params': params
    })
    self.events.sort(key=lambda x: x['time'])
```
- 시뮬레이션 중 발생할 이벤트 정의
- 이벤트 발생 시간 기준 자동 정렬
- 이벤트 타입과 파라미터를 유연하게 정의


### 6. 참고 문헌
- 3GPP TS 38.300: 전반적인 네트워크 구성과 아키텍쳐