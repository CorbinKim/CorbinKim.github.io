---
layout: post
title: 오프로딩 시뮬레이터 - Logger
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

# 5G 셀 시뮬레이터 구현 가이드: `utils/logger.py`

## 1. 아키텍쳐 개요

`logger.py`는 시뮬레이션 중 발생하는 이벤트, 메트릭, 디버그 정보를 체계적으로 기록하고 관리하는 부분임. 주요 컴포넌트는 아래와 같음.

- 파일/콘솔 로깅 지원
- 로그 파일 자동 순환
- 시계열 메트릭 저장
- 메트릭 시각화
- 다양한 로깅 레벨

---

## 2. 코드 설명

### 1. 기본 로깅 기능

``` python
def __init__(self, name: str,
             log_dir: str = 'logs',
             level: str = 'INFO',
             console_output: bool = True,
             file_output: bool = True,
             rotation: str = 'size',
             max_bytes: int = 10*1024*1024,  # 10MB
             backup_count: int = 5):
    """
    Parameters
    ----------
    name : str
        로거 이름
    log_dir : str
        로그 파일 저장 디렉토리
    level : str
        로깅 레벨 ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
    console_output : bool
        콘솔 출력 여부
    file_output : bool
        파일 출력 여부
    rotation : str
        로그 순환 방식 ('size' 또는 'time')
    max_bytes : int
        최대 로그 파일 크기
    backup_count : int
        보관할 백업 파일 수
    """
```

- 핵심 초기화 파라미터
    - name: logger 식별자
    - log_dir: 로그 저장 위치
    - level: 로깅 상세도
    - rotation: 파일 순환 방식
    - max_bytes: 파일 크기 제한

### 2. 이벤트 로깅

``` python
def log_event(self, event_type: str, details: Dict[str, Any]):
    """이벤트 기록
    
    Parameters
    ----------
    event_type : str
        이벤트 유형
    details : dict
        이벤트 상세 정보
    """
    self.logger.info(f"Event: {event_type} - {json.dumps(details)}")
```

- 시뮬레이션 이벤트 로깅
    - 이벤트 유형 분류
    - JSON 형식 상세 정보
    - 시간 자동 기록


### 3. 메트릭 관리
``` python
def log_metric(self, name: str, value: Any, 
               timestamp: Optional[float] = None):
    """메트릭 기록
    
    Parameters
    ----------
    name : str
        메트릭 이름
    value : any
        메트릭 값
    timestamp : float, optional
        타임스탬프 (기본값: 현재 시간)
    """
    if timestamp is None:
        timestamp = datetime.now().timestamp()
        
    if name not in self.metrics:
        self.metrics[name] = []
        
    self.metrics[name].append({
        'timestamp': timestamp,
        'value': value
    })
```

- 시계열 메트릭 저장
    - 이름 기반 분류
    - 시간 정보 포함
    - 메모리 내 저장


### 4. 네트워크 상태 로깅

``` python
def log_network_state(self, cells: list, ues: list):
    """네트워크 상태 기록
    
    Parameters
    ----------
    cells : list
        셀 객체 리스트
    ues : list
        UE 객체 리스트
    """
    state = {
        'timestamp': datetime.now().timestamp(),
        'cells': [{
            'id': cell.i,
            'position': cell.xyz.tolist(),
            'active_freqs': [f for f in cell.freq_config 
                           if cell.freq_config[f]['active']],
            'load': cell.get_cell_load(),
            'energy': cell.get_energy_stats()
        } for cell in cells],
        'ues': [{
            'id': ue.i,
            'position': ue.xyz.tolist(),
            'serving_cell': ue.serving_cell.i if ue.serving_cell else None,
            'metrics': ue.get_metrics()
        } for ue in ues]
    }
    
    self.logger.debug(f"Network State: {json.dumps(state)}")
```

- 전체 네트워크 상태 스냅샷
    - 셀 상태 정보
    - UE 연결 정보
    - JSON 형식 저장


### 5. 메트릭 시각화

``` python
def plot_metrics(self, metric_names: Optional[list] = None):
    """메트릭 플롯 생성
    
    Parameters
    ----------
    metric_names : list, optional
        플롯할 메트릭 이름 리스트 (기본값: 모든 메트릭)
    """
    try:
        import matplotlib.pyplot as plt
        
        if metric_names is None:
            metric_names = list(self.metrics.keys())
            
        for name in metric_names:
            if name not in self.metrics:
                continue
                
            data = self.metrics[name]
            timestamps = [d['timestamp'] for d in data]
            values = [d['value'] for d in data]
            
            plt.figure(figsize=(10, 6))
            plt.plot(timestamps, values)
            plt.title(f'Metric: {name}')
            plt.xlabel('Timestamp')
            plt.ylabel('Value')
            plt.grid(True)
            
            plot_file = self.log_dir / f"metric_{name}_{datetime.now():%Y%m%d_%H%M%S}.png"
            plt.savefig(plot_file)
            plt.close()
            
    except ImportError:
        self.warning("matplotlib is required for plotting metrics")
```

- 메트릭 시각화 도구
    - matplotlib 기반 그래프
    - 시계열 플롯 생성
    - PNG 파일 저장


### 6. 유틸리티 함수

``` python
def get_logger(self) -> logging.Logger:
    """로거 인스턴스 반환"""
    return self.logger

def clear_metrics(self):
    """메트릭 초기화"""
    self.metrics.clear()
```

- logger 인스턴스 접근
- 메트릭 데이터 관리


### 7. 네트워크 시각화

#### 7.1 주파수 대역별 커버리지 시각화

네트워크 상태를 시각적으로 표현하기 위해 `plot_frequency_band_coverage` 함수를 구현

``` python
def plot_frequency_band_coverage(self,
                               cells: list,
                               ues: list,
                               grid_size: Tuple[int, int] = (200, 200),
                               save_path: Optional[str] = None):
    """주파수 대역별 커버리지 및 UE 연결 상태 시각화
    
    Parameters
    ----------
    cells : list
        셀 객체 리스트
    ues : list
        UE 객체 리스트
    grid_size : tuple
        그리드 해상도 (기본값: 200x200)
    save_path : str, optional
        저장 경로 (기본값: logs/freq_band_coverage_YYYYMMDD_HHMMSS.png)
    """
```

- 주요 컴포넌트

    - 주파수 대역 설정
    
    ``` python
    # 주파수 대역별 설정
    frequency_bands = {
        800: {'color': 'RdYlBu_r', 'title': '800 MHz Coverage'},
        1800: {'color': 'RdYlBu_r', 'title': '1800 MHz Coverage'},
        3600: {'color': 'RdYlBu_r', 'title': '3600 MHz Coverage'}
    }

    # 셀별 색상 할당
    cell_colors = plt.cm.Set3(np.linspace(0, 1, len(cells)))
    cell_color_dict = {cell.i: cell_colors[i] for i, cell in enumerate(cells)}
    ```

    - 커버리지 맵 생성
    
    ``` python
    # RSRP 계산
    for i in range(grid_size[0]):
        for j in range(grid_size[1]):
            point = np.array([X[i,j], Y[i,j], 0])
            max_rsrp = float('-inf')
            
            for cell in cells:
                if (freq in cell.freq_config and 
                    cell.freq_config[freq]['active']):
                    rsrp = cell.calculate_rsrp(point, freq)
                    max_rsrp = max(max_rsrp, rsrp)
            
            Z[i,j] = max_rsrp

    # 커버리지 맵 플로팅
    coverage = ax.pcolormesh(X, Y, Z,
                        shading='auto',
                        cmap=freq_info['color'],
                        alpha=0.5,
                        vmin=-120, vmax=-60)
    plt.colorbar(coverage, ax=ax, label='RSRP (dBm)')
    ```

    - 셀과 UE 시각화
    
    ``` python
    # 셀 표시
    ax.scatter(pos[0], pos[1],
          c=[color],
          marker='^',
          s=200,
          label=f'Cell {cell.i}',
          edgecolors='black',
          linewidth=1.5)

    # UE 표시
    ax.scatter(pos[0], pos[1],
            c=[color],
            marker='o',
            s=100,
            edgecolors='black',
            linewidth=1,
            alpha=0.7)
    ```