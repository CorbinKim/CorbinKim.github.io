---
layout: project
title: 'O-RAN AIMLFW'
caption: AI/ML Framework for O-RAN Software Community
description: >
  Contributing to the AIMLFW project within the O-RAN Software Community,
  building AI/ML pipelines for intelligent RAN management.
date: '2024-04-01'
image:
  path: /assets/img/projects/hydejack-site.jpg
  srcset:
    1920w: /assets/img/projects/hydejack-site.jpg
    960w:  /assets/img/projects/hydejack-site@0,5x.jpg
    480w:  /assets/img/projects/hydejack-site@0,25x.jpg
links:
  - title: O-RAN SC
    url: https://wiki.o-ran-sc.org/display/AIMLFW
featured: true
sitemap: true
---

# O-RAN AIMLFW

## Introduction


## Installation

1. 설치 스크립트 실행
   
```
bin/install_traininghost.sh
```

![Fig 1](/assets/img/projects/aimlfw/installation_1.png)


2. 10 - 20분 정도 기다린 후 파드가 잘 설치되어 있는지 확인
   
```
kubectl get pod -A
```

![Fig 2](/assets/img/projects/aimlfw/installation_2.png)