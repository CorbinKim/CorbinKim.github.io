---
layout: post
title: 오프로딩 시뮬레이터 - Storage 
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

# 5G 셀 시뮬레이터 구현 가이드: `traffic/storage`

## 1. 아키텍쳐 개요

### 1.1 핵심 구조 
- 계층적 저장소 시스템
  - 기본 데이터 수집기 (BaseCollector)
  - 시계열 데이터베이스 관리 (TimeSeiresDB)
  - 주파수별 데이터 수집 (FrequencyCollector)

### 1.2 주요 컴포넌트
1. 시계열 데이터베이스 (TimeSeiresDB)
  - SQLite 기반의 경량 데이터베이스
  - 트래픽 데이터의 시계열 저장
  - 효율적인 쿼리 처리

2. 주파수 수집기 (FrequencyCollector)
  - 주파수별 트래픽 데이터 수집
  - 실시간 데이터 처리
  - 메모리 효율적 버퍼링

### 1.3 데이터 흐름

1. 데이터 수집
Cell 데이터 생성 $\rightarrow$ FrequencyCollector 수집 $\rightarrow$ 임시 버퍼 저장 $\rightarrow$ TimeSeriesDB 저장

2. 데이터 조회
쿼리 요청 $\rightarrow$ TimeSeriesDB 검색 $\rightarrow$ 데이터 전처리 $\rightarrow$ 결과 반환

## 2. 코드 설명

### 2.1 TimeSeriesDB(timeseries_db.py)

``` python
class TimeSeriesDB:
    """
    시계열 데이터 저장소
    
    주요 기능:
    - SQLite 기반 데이터 저장
    - 효율적인 시계열 데이터 관리
    - 셀별/주파수별 데이터 조회
    
    사용 예시:
    db = TimeSeriesDB('traffic.db')
    db.store_traffic_data(cell_id=1, data=traffic_data)
    cell_data = db.get_cell_data(cell_id=1)
    """
```

1. 테이블 스키마 설계
- timestamp: 데이터 수집 시간
- cell_id: 셀 식별자
- frequency: 주파수 대역들
- metrics: 성능 지표

### 2.2 FrequencyCollector(frequency_collector.py)

``` python
class FrequencyCollector:
    """
    주파수별 트래픽 데이터 수집기
    
    주요 기능:
    - 실시간 트래픽 데이터 수집
    - 주파수별 데이터 분류
    - 효율적인 메모리 관리
    
    사용 예시:
    collector = FrequencyCollector(cell, sampling_interval=1.0)
    data = collector.collect()
    """
```

1. 샘플링 전략
- 적절한 샘플링 간격 설정
- 데이터 정확성과 저장 공간의 균형

2. 메모리 관리
- 순환 버퍼 사용
- 주기적인 데이터 플러시