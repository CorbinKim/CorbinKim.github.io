---
layout: post
title: OSC AIMLFW Installation
description: > 
  O-RAN Software Community 프로젝트 AIMLFW 설치 정리
image: 
  path: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
  srcset: 
    1920w: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
    960w:  /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash@0,5x.jpg
    480w:  /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash@0,25x.jpg
# accent_image: /assets/img/blog/pawel-czerwinski-848z7lbCjoo-unsplash.jpg
excerpt_separator: <!--more-->
sitemap: false
---


<!--more-->
* toc
{:toc .large-only}









# O-RAN AIMLFW Installation

## Introduction


### Installation

- 설치 스크립트 실행


```
bin/install_traininghost.sh
```

![Fig 1](/assets/img/blog/aimlfw_installation/installation_1.png)

---

- 10 - 20분 정도 기다린 후 파드가 잘 설치되어 있는지 확인


```
kubectl get pod -A
```

![Fig 2](/assets/img/blog/aimlfw_installation/installation_2.png)

---

- 서비스를 확인하여 어떤 포트들이 열려있는지 확인

![Fig 3](/assets/img/blog/aimlfw_installation/installation_3.png)

---

- `32005` 포트로 대시보드 들어가보기

![Fig 4](/assets/img/blog/aimlfw_installation/installation_4.png)

---

- Install Influx DB as datalake

```
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-release bitnami/influxdb --version 5.13.5
kubectl exec -it <pod name> bash
```
  

![Fig 5](/assets/img/blog/aimlfw_installation/installation_5.png)

---

- 커맨드를 입력하여 `username`, `org name`, `org id` 그리고 `access token` 얻기

```
cat bitnami/influxdb/influxd.bolt | tr -cd "[:print:]"
```


![Fig 6](/assets/img/blog/aimlfw_installation/installation_6.png)



![Fig 7](/assets/img/blog/aimlfw_installation/installation_7.png)

---

- 원활한 코드 진행을 위해 별도의 모듈들을 설치해준다.


```
sudo apt install pip
sudo pip3 install pandas
sudo pip3 install influxdb_client
```

![Fig 8](/assets/img/blog/aimlfw_installation/installation_8.png)

---

위의 과정을 마치게 되면 `AIMLFW`를 사용할 수 있는 정말 기초적인 준비가 끝나게 된다.