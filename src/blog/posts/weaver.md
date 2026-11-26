---
title: "WEAVER"
date: "2026-11-23"
excerpt: "A System for AI-RAN Compute Sharing with Foundation Model Training"
tags: ["AI-RAN", "GPU sharing", "FM training", "Compute harvesting"]
cover: "/img/blog/weaver/screenshot-2026-11-23-at-5-10-19-pm-e17edb74.png"
---

- Authors: Xue et al.
- Venue: MobiCom Demo, 2026

# 1. Research Problem

GPU-equipped radio access networks create an opportunity to run AI workloads on compute infrastructure that primarily serves RAN processing. RAN hardware is provisioned for peak demand, but its actual workload changes with network traffic, leaving capacity that other workloads could use. The paper asks whether this spare capacity can support foundation model training while preserving the strict deadlines of RAN processing.

The difficulty is that spare capacity is neither constant nor equally available across cell sites. Short bursts of RAN traffic can quickly change GPU demand within a site, while longer-term traffic patterns differ across sites. A training system therefore needs to use capacity when it is available, yield it when the RAN needs it, and adapt its work to changing resources.

The authors organize this problem into three questions.

1. **How much spare GPU capacity exists and how it varies**
2. **How to make that capacity usable without affecting RAN performance**
3. **How to train efficiently across sites with dynamic, heterogeneous resources**

WEAVER is their proposed system for addressing these questions.

# 2. Background

## 2.1 GPU Accelerated in Virtualized RANs

A virtualized RAN moves baseband processing onto general-purpose computing platforms. Its Distributed Unit runs compute-intensive MAC and PHY functions, including LDPC decoding, which must satisfy millisecond-scale deadlines. GPUs offer a programmable way to accelerate this processing, but sharing them with another workload makes timely RAN execution a central requirement.

## 2.2 What "Spare GPU Capacity" Means

The paper describes GPU load through three measures:

- **SM utilization** measures the fraction of streaming multiprocessors assigned to a kernel
- **Arithmetic compute utilization** measures achieved arithmetic throughput relative to the GPU's peak
- **Global bandwidth utilization** measures achieved memory bandwidth relative to its peak

Together, these measures provide a more specific account of GPU use than a single utilization number.

![](/img/blog/weaver/image-2a6879ac.png)

This distinction matters for WEAVER because the authors describe the RAN processing they study as limited by memory bandwidth, whereas foundation model training is dominated by arithmetic-heavy matrix multiplications. Their proposed sharing opportunity follows from those different resource demands: training may be able to use arithmetic capacity that RAN processing leaves idle.

## 2.3 GPU Sharing Under RAN Deadlines

Earlier systems have partitioned GPUs between RAN processing and AI workloads using predicted RAN demand. According to the paper, allocating too much capacity to the RAN restricts the colocated workload, while allocating too little risks missing PHY deadlines. The paper also reports substantial reconfiguration times for MPS and MIG, making frequent adjustments difficult at the timescale of RAN processing.

The authors identify Green Contexts as a useful mechanism because it combines hardware isolation of streaming multiprocessor with reconfiguration on a microsecond timescale. This supplies the GPU-sharing mechanism for WEAVER's RAN-first approach, in which the RAN determines what capacity training may use.

# 3. Characterizing Space Compute

## 3.1 Within a Cell Site

The authors profile GPU-accelerated LDPC decoding across modulation and coding schemes and physical resource block (PRB) allocations on a 48-SM NVIDIA DGX Spark. In their measurements, even the worst-case configuration completes decoding in about 700 μs within a typical 1 ms deadline. Most tested operating points use fewer than 20% of the GPU's SMs.

The measurements also show low arithmetic utilization alongside higher memory-bandwidth utilization. The authors interpret this as an opportunity for compute-intensive FM training to use arithmetic capacity left idle during LDPC decoding.

## 3.2 Across Cell Sites

The authors replay production traffic traces from six urban and suburban cell sites. Traffic and SM use generally rise during the day and fall overnight, but sites differ in their load and peak at different times. Even at the busiest site's peak, the paper reports roughly 85% spare SM capacity.

![](/img/blog/weaver/image-19c0e36d.png)

# 4. WEAVER's Design

## 4.1 A RAN-Centric Spare-Compute Controller

WEAVER reserves a set of SMs for RAN processing and exposes the remainder to FM training. Its controller sits within the RAN stack because MAC scheduling decisions determine how much LDPC decoding work a slot creates.

The controller has three main steps:

1. **PRB budgeting**: An offline lookup table relates an SM reservation and modulation and coding scheme to a PRB budget that meets the decoding deadline. The standard scheduler then allocates PRBs within that budget.
2. **Adaptive SM adjustment**: The controller watches user-equipment blocks. It raises the RAN reservation promptly when backlog approaches a service-quality threshold, but lowers it more cautiously to avoid unnecessary changes.
3. **Final allowance check**: Because the actual coding mix is known only after scheduling, the controller checks the completed allocation against the updated lookup-table allowance and repeats the process if necessary.

The purpose is to make space capacity more useful, not merely to maximize its average amount. Rapid changes in the RAN reservation repeatedly disrupt training kernels; a steadier reservation gives training longer intervals in which it can make progress.

![](/img/blog/weaver/image-5a1cba70.png)

## 4.2 Two-Level Elastic Training

A steadier local reservation does not make spare capacity constant. Capacity still changes within a site and differs across sites, so a static distributed training configuration can leave some workers idle while others become stragglers. WEAVER adapts training at two levels:

- **Within each site**, WEAVER divides long-running GEMM operations into smaller tiles. The scheduler admits a tile only when it is expected to finish within the current RAN slot and fit the remaining resource budget.
- **Across sites during short-term changes**, asynchronous inter-site rerouting (AIR) redirects pending micro-batch stage tasks to another executor that already holds the required model parameters. It transfers inputs or activations rather than migrating model state.
- **Across sites during persistent imbalance**, model layout rebalancing (MLR) moves pipeline-stage boundaries so that an overloaded site can shed layers. WEAVER invokes this slower mechanism when repeated task deferrals show that rerouting alone is insufficient.

I read this as a division of responsibility by timescale: GEMM tiles respond to slot-level changes, AIR moves queued work when a site slows down, and MLR changes the model layout only when that slowdown persists.

# 5. Evaluation

The evaluation first tests the RAN controller on a live 5G NR stack with GPU-accelerated LDPC decoding. It then tests distributed training on an eight-site GPU testbed using replayed RAN capacity traces.

## 5.1 RAN Performance and Usable Compute

Across two 600-second traffic scenarios, WEAVER reduces changes in the RAN SM reservation by **4.0 - 4.9x** relative to an unmodified scheduler. Both achieve a **99.8% HARQ deadline-met rate** in those scenarios. In the reported over-the-air and application tests, throughput and call-quality measures remain comparable to those of the unmodified scheduler.

With a colocated chain of GEMM operations, WEAVER delivers approximately **1.4 TFLOPS** of useful throughput in both scenarios, compared with **0.481 and 0.779 TFLOPS** under the unmodified scheduler. In a separate L40S training experiment using recorded RAN reservations, WEAVER uses **83% of available spare compute**, compared with **67%** for the unmodified scheduler and **32%** for the evaluated MPS-based approach.

## 5.2 Distributed Training

On the eight-site testbed, WEAVER achieves 2.1x the token throughput of the strongest evaluated baseline for OPT-1.3B and 3.7x for OPT-6.7B under the reported trace replay. It also achieves a higher fraction of peak cluster compute throughput across the tested model sizes.

![](/img/blog/weaver/image-4e8bae84.png)

A six-minute replay examines how the inter-site mechanisms respond to changing capacity. AIR handles 86.2% of the reported shifts without invoking MLR, while 11 events escalate to layout rebalancing. The paper also evaluates 128-512 site deployments and larger models using a profile-based simulator, rather than the physical eight-site testbed.

# 6. Assessment

The paper's clearest contribution is to make spare GPU capacity more usable through RAN-controlled scheduling, then match training work to that capacity at multiple timescales. Its characterization supports the design by examining SM occupancy, arithmetic use, memory-bandwidth use, and variation across sites.

The strongest experimental evidence comes from the evaluated GPU-accelerated LDPC setting and eight-site testbed: WEAVER produces steadier reservations and higher training throughput while preserving the reported RAN performance measures. My reading is that WEAVER demonstrates a promising design for operator-controlled AI-RAN infrastructure; the authors leave full-L1 GPU acceleration, stronger isolation for third-party training workloads, and longer production-scale convergence studies for future work.
