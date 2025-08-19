---
layout: post
title: "Open RAN Testbed Development Log Day 1 - Kubernetes Infrastructure Setup"
date: 2025-08-18
categories: [open-ran, testbed]
tags: [open5gs, kubernetes, 5g-core, microservices, troubleshooting]
description: >
  Day 1 of building an Open RAN testbed on Kubernetes - tackling SMF configuration issues, 
  storage problems, and establishing a solid foundation for 5G core network deployment.
---

# Day 1: Kubernetes Infrastructure Setup

Today's goal was to resolve the failing SMF (Session Management Function) deployment in our Open RAN testbed. What started as a simple configuration fix evolved into a comprehensive infrastructure overhaul using industry best practices.

## What I Did Today

### 1. Initial Problem Diagnosis
- **SMF Container Issues**: Discovered that the Session Management Function (SMF) was failing to start due to DNS resolution errors and configuration parsing failures
- **Root Cause Analysis**: Identified incorrect YAML structure in SMF configuration that didn't match Open5GS official format
- **Error Pattern**: `getaddrinfo(0:open5gs-nrf-service:7777:0x0) failed` and `ogs_sbi_context_parse_config: Assertion failed`

### 2. Official Documentation Deep Dive
- **Configuration Format Research**: Studied Open5GS official documentation and GitHub repository for proper SMF configuration structure
- **SBI Architecture Understanding**: Learned about Service Based Interface (SBI) client/server separation in 5G core
- **Network Function Discovery**: Understood how SMF connects to NRF through SCP (Service Communication Proxy)

### 3. Infrastructure Pivot to Professional Solution
- **Repository Discovery**: Found `niloysh/open5gs-k8s` - a battle-tested, production-ready Open5GS deployment for Kubernetes
- **Architecture Benefits**: 
  - Microservices architecture with separate pods for each Network Function
  - Multi-slice support (2 network slices by default)
  - Kustomize-based configuration management
  - Multus CNI integration for advanced networking

### 4. Storage Infrastructure Setup
- **PersistentVolume Challenge**: MongoDB StatefulSet failed due to missing storage class
- **Local Storage Solution**: Created custom StorageClass with local storage provisioner
- **Volume Management**: Set up PersistentVolume with proper node affinity and access modes

## Key Technical Insights

### Open5GS Configuration Structure
```yaml
# Correct SMF configuration format
smf:
  sbi:
    server:
      - address: 0.0.0.0
        port: 7777
    client:
      scp:
        - uri: http://open5gs-nrf-service:7777
  session:
    - subnet: 10.45.0.0/16
      gateway: 10.45.0.1
```

### Kubernetes Storage Challenges
- **Issue**: `pod has unbound immediate PersistentVolumeClaims`
- **Solution**: Manual PersistentVolume creation with local storage
- **Learning**: Single-node clusters require careful storage planning

### Network Architecture Insights
- **N2/N3/N4 Interfaces**: Understanding of 5G interface segregation using OVS bridges
- **Multus CNI**: Secondary network interfaces for proper 5G core traffic separation
- **Service Discovery**: NRF-based network function registration and discovery

## Tomorrow's Goals

### Phase 1: Complete 5G Core Setup
- [ ] Complete MongoDB deployment and verify connectivity
- [ ] Deploy Network Attachment Definitions (NADs) for Multus
- [ ] Deploy complete Open5GS 5G core with all network functions
- [ ] Set up Open5GS WebUI for subscriber management

### Phase 2: srsRAN Integration
- [ ] Study srsRAN official documentation and architecture
- [ ] Create custom Docker image for srsRAN gNB
- [ ] Design Kubernetes deployment manifests for srsRAN
- [ ] Deploy srsRAN on Kubernetes cluster
- [ ] Test integration between Open5GS core and srsRAN gNB

**Primary Focus**: Building srsRAN Docker containers and deploying them on Kubernetes to create a complete end-to-end 5G network with real RAN implementation instead of simulation.

## Technical Challenges Overcome

### 1. Configuration Format Mismatch
**Problem**: Custom SMF configuration didn't follow Open5GS standards  
**Solution**: Adopted proven configuration from specialized repository

### 2. Storage Class Limitations
**Problem**: Kubernetes cluster lacked default storage provisioner  
**Solution**: Created local storage class with manual PV provisioning

### 3. Microservices Complexity
**Problem**: Managing multiple interdependent 5G network functions  
**Solution**: Leveraged Kustomize for organized, declarative deployments

## Architecture Decisions Made

1. **Switched to `niloysh/open5gs-k8s`** for proven, production-ready deployment
2. **Adopted microservices approach** with separate pods for each NF
3. **Implemented local storage strategy** for single-node development environment
4. **Planned Multus CNI integration** for proper network interface management

## Learning Outcomes

- **5G Core Architecture**: Deep understanding of SMF, AMF, UPF, and NRF interactions
- **Kubernetes Storage**: Hands-on experience with PV, PVC, and StorageClass management
- **Configuration Management**: Importance of following official documentation and proven patterns
- **Infrastructure Planning**: Value of using established, community-tested solutions

---

*This is part of my daily development log for the Open RAN Testbed project. The goal is to build a comprehensive 5G testing environment using cloud-native technologies and open-source implementations.*
