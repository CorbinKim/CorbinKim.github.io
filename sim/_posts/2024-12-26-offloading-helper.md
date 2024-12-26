---
layout: post
title: 오프로딩 시뮬레이터 - Helper
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

# 5G 셀 시뮬레이터 구현 가이드: `utils/hleper.py`

## 1. 아키텍쳐 개요

helpers.py는 시뮬레이터 전반에서 사용되는 유틸리티 함수들을 제공함. 이 모듈은 다음과 같은 주요 컴포넌트들로 구성되어 있음.

- Logger Setup: 로깅 시스템 설정 및 관리
- Geometric Utilities: 3D 공간에서의 기하학적 계산
- Signal Processing: 신호 처리 관련 유틸리티
- Data Management: 데이터 저장 및 로드 기능
- Network Analysis: 네트워크 성능 분석 도구
- Grid Generation: 시뮬레이션 영역 내 위치 생성


## 2. 코드 설명

### 1. Logger Setup

```python
def setup_logger(name: str, level: str = 'INFO',
                log_file: Optional[str] = None) -> logging.Logger:
    """로깅 설정
    
    Parameters
    ----------
    name : str
        로거 이름
    level : str
        로깅 레벨 ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
    log_file : str, optional
        로그 파일 경로
        
    Returns
    -------
    logging.Logger
        설정된 로거 인스턴스
    """
```

- `setup_logger`: 로깅 시스템 초기화
    - name: logger 이름 지정
    - level: logging 레벨 설정
    - log_fie: 파일 출력 설정
    - 파일과 콘솔 동시 출력 지원


### 2. Geometric Utilities

``` python
def calculate_distance(point1: np.ndarray,
                      point2: np.ndarray) -> float:
    return np.linalg.norm(point1 - point2)

def calculate_angle(point1: np.ndarray,
                   point2: np.ndarray) -> Tuple[float, float]:
    diff = point2 - point1
    azimuth = np.arctan2(diff[1], diff[0])
    r_xy = np.sqrt(diff[0]**2 + diff[1]**2)
    elevation = np.arctan2(diff[2], r_xy)
    return azimuth, elevation
```

- `calculate_distance`: 3D 유클리드 거리 계산
    - numpy 배열 기반 효율적 계산
    - 벡터화 연산 지원
- `calculate_angle`: 방위각과 고도각 계산
    - azimuth: XY평면에서의 각도
    - elevation: XY평면과 Z축 사이의 각도
    - 라디안 단위 변환


### 3. Signal Processing

``` python
def db_to_linear(db_value: float) -> float:
    return 10**(db_value/10)

def linear_to_db(linear_value: float) -> float:
    return 10 * np.log10(linear_value)

def calculate_throughput(sinr: float,
                        bandwidth: float,
                        efficiency: float = 0.8) -> float:
    capacity = bandwidth * efficiency * np.log2(1 + db_to_linear(sinr))
    return capacity
```

- `db_to_linear`, `linear_to_db`: 단위 변환
  - dB 값과 선형 값 사이의 변환
  - 로그 스케일 처리
- `calculate_throughput`: 처리량 계산
  - SINR: Signal-to-Interference-and-Noise Ratio (dB)
  - bandwidth: 대역폭 (Hz)
  - efficiency: 스펙트럼 효율성 (0-1)
  - Shannon capacity formula 이용


### 4. Data Management

``` python
def save_results(results: Dict,
                filepath: str) -> None:
    """시뮬레이션 결과를 JSON 형식으로 저장
    
    Parameters
    ----------
    results : dict
        저장할 결과 데이터
    filepath : str
        저장 경로. '.json' 확장자가 없으면 자동으로 추가
    """
    def convert_numpy(obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {k: convert_numpy(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_numpy(i) for i in obj]
        return obj
    
    # NumPy 배열을 리스트로 변환
    results = convert_numpy(results)
    
    # 파일 경로 처리
    path = Path(filepath)
    if path.suffix != '.json':
        path = path.with_suffix('.json')
    
    # 부모 디렉토리 생성
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # JSON 파일로 저장
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

def load_results(filepath: str) -> Dict:
    """JSON 형식의 시뮬레이션 결과 로드
    
    Parameters
    ----------
    filepath : str
        로드할 파일 경로
        
    Returns
    -------
    dict
        결과 데이터
    """
    path = Path(filepath)
    if path.suffix != '.json':
        path = path.with_suffix('.json')
        
    if not path.exists():
        raise FileNotFoundError(f"결과 파일을 찾을 수 없습니다: {path}")
        
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)
```

- `save_results`: 시뮬레이션 결과 저장

  - NumPy 배열 자동 변환
  - JSON 형식으로 저장
  - 디렉토리 자동 생성


- `load_results`: 저장된 결과 로드

  - JSON 파일 로드
  - 파일 존재 여부 검증


### 5. Network Analysis

``` python
def calculate_network_metrics(cells: List,
                            ues: List) -> Dict:
    metrics = {
        'network_load': 0,
        'total_throughput': 0,
        'average_latency': 0,
        'energy_consumption': 0,
        'user_satisfaction': 0
    }
    
    active_cells = 0
    for cell in cells:
        cell_metrics = cell.get_metrics()
        metrics['network_load'] += cell_metrics['load']
        metrics['total_throughput'] += cell_metrics['throughput']
        metrics['energy_consumption'] += cell_metrics['energy']
        if cell_metrics['load'] > 0:
            active_cells += 1
            
    if active_cells > 0:
        metrics['network_load'] /= active_cells

    satisfied_users = sum(1 for ue in ues if ue.get_qos_satisfaction()['throughput'])
    if ues:
        metrics['user_satisfaction'] = satisfied_users / len(ues)
    
    return metrics
```

- `calculate_network_metrics`: 네트워크 전체 성능 분석

  - 전체 네타워크 부하 계산
  - 처리량 및 에너지 소비 분석
  - QoS 만족도 평가 


### 6. Grid Generation

``` python
def generate_grid_positions(area_bounds: Tuple[np.ndarray, np.ndarray],
                          n_points: int) -> np.ndarray:
    n_per_dim = int(np.ceil(np.sqrt(n_points)))
    x = np.linspace(area_bounds[0][0], area_bounds[1][0], n_per_dim)
    y = np.linspace(area_bounds[0][1], area_bounds[1][1], n_per_dim)
    
    X, Y = np.meshgrid(x, y)
    positions = np.stack([X.flatten(), Y.flatten(), 
                         np.zeros_like(X.flatten())], axis=-1)
    
    return positions[:n_points]

def generate_timestamp() -> str:
    return datetime.now().strftime('%Y%m%d_%H%M%S')
```

- `generate_grid_positions`: 균일 그리드 위치 생성 
  - area_bounds: 시뮬레이션 영역 경계
  - n_points: 생성할 포인트 수 
  - 2D 평면에 균일하게 분포된 위치 생성

- `generate_timestamp`: 타임스탬프 생성
  - YYYYMMDD_HHMMSS 형식
  - 파일명이나 로그에 사용