---
title: "Bringing dApps to OCUDU"
date: "2026-11-18"
excerpt: "An E3 Controller for Real-Time Open RAN Intelligence"
tags: ["In-network processing", "Network experimentation", "Network measurement"]
cover: "/img/blog/bringing-dapps-to-ocudu/unknown-1746f2dc.png"
---

- Authors: Feraudo et al.
- Venue: ACM WiNTECH'26

# Introduction

## Background and motivation

Open RAN uses xApps in the Near-RT RIC and rApps in the Non-RT RIC to control the network. Applications such as spectrum sensing, beam tracking, and per-slot scheduling need faster access to PHY and MAC signals than the E2 interface can provide.

dApps address this need by running alongside the RAN node and reacting within hundreds of microseconds. The **E3 interface** defines how a dApp subscribes to data, receives indications, and sends control actions, so that dApps can work across different RAN implementations.

## Gap addressed by the paper

E3 had been implemented in OpenAirInterface and NVIDIA Aerial, but OCUDU lacked a comparable interface. Existing OCUDU-related instrumentation could expose RAN data with low latency, but did not provide a defined E3 interface for dApps.

![](/img/blog/bringing-dapps-to-ocudu/image-1746f2dc.png)

## Proposed approach

Authors introduce **E3Controller**, a separate process running on the same host as OCUDU. It handles the E3 protocol and dApp interactions, while two instrumentation hooks connect it to OCUDU's fronthaul receive path and upper PHY layer. The design aims to add a dApp-facing E3 path with limited changes to OCUDU's core processing.

The authors demonstrate the path with two service models, **Spectrum** and **L1**. In the implementation described in the introduction, both support data reporting; E3 control actions are still under development. Their evaluation with commercial radio hardware reports no measurable reduction in OCUDU throughput from the E3 data path.

# Related Work

## dApps and real-time RAN control

dApps were proposed to overcome the latency limits of the Near-RT RIC by placing faster control applications alongside the RAN node. The concept was later developed into an architecture with the E3 interface and a reference implementation on OpenAirInterface; the paper also reports dApp and E3 implementations in NVIDIA Aerial and Radisys.

Other work changes the application runtime, for example by using WebAssembly, or introduces a dedicated real-time controller. EdgeRIC places its controller outside the RAN, whereas TinyRIC embeds a lightweight controller in the base station. The authors distinguish these approaches from the E3-based dApp architecture.

## Signal extraction and RAN instrumentation

RANBooster extracts I/Q data by intercepting O-RAN fronthaul traffic in an external middlebox. This paper instead places hooks inside OCUDU's fronthaul receive path and upper PHY layer, then delivers the extracted data to dApps through E3.

## Positioning of this paper

According to the authors, prior work addressed E3 dApps, real-time control, fronthaul data extraction, and jbpf instrumentation separately, but did not combine them into an **end-to-end E3 implementation for OCUDU**. Their contribution is to connect lightweight OCUDU hooks to standard E3 procedures, making fronthaul and PHY data available to E3-compliant dApps.

# An E3 Controller for Real-Time Open RAN Intelligence

This section explains how data moves from an OCUDU gNB to a subscribed dApp. The design separates E3 processing from the gNB and uses different delivery methods for the two I/Q service models.

![](/img/blog/bringing-dapps-to-ocudu/image-1888c0aa.png)

## Sidecar Architecture

The E3Controller runs as a separate process alongside the OCUDU gNB. It manages E3AP and service model encoding and decoding, dApp subscription, control requests, and message dispatch. Inside OCUDU, the integration requires instrumentation hooks and jbpf agent initialization; the E3 protocol stack remains outside the gNB process.

Two jbpf IPC mechanisms connect the processes. Shared memory carries data extracted from the gNB to the controller, while an LCM IPC socket lets the controller load and unload codelets in the running gNB. This boundary is intended to let E3 components evolve without placing their protocol logic in OCUDU's core processing code.

When a dApp subscribes, the controller loads the codelet for the requested servicve model. Each time the corresponding hook fires, the codelet extracts data and writes it to a jbpf output channel identified by a `stream_id`. The controller reads the data from shared memory, constructs an E3 indication, and delivers it to the subscriber. It unloads the codelet when the last subscriber leaves.

## Dispatcher and Three-Stage Pipeline

The controller's data path has three stages - poll, worker, and publisher - each running on a dedicated thread. In the poll stage, `JbpfDispatcher` uses the buffer's `stream_id` to route it to the appropriate pipeline. The dispatcher does only this lightweight routing; it leaves payload processing to the worker.

The **worker** drains its pipeline queue and performs the processing required by the service model. For Spectrum, it decompressed and remaps fronthaul sections. For L1, it validates shared-memory descriptors and fills in the Indication; the controller does not process the I/Q samples themselves on that path. Finally, the **publisher** serializes the outer E3AP message as ASN.1 APER or JSON and transmits it over ZMQ.

The dispatcher normally releasees as a jbpf buffer immediately after routing it. For a large payload, it can instead transfer buffer ownership to the worker, which releases it after all subscribed service models have consumed the data. This avoids an additional payload copy during delivery.

## Service Models: Spectrum and L1

**Spectrum and L1 observe the same uplink I/Q stream at different points** in the gNB processing pipeline. A service model loads its codelet when the first dApp subscribes and removes it when the last subscription ends. 

**Spectrum operates before upper-PHY decompression, at the fronthaul U-Plane uplink hook.** For each received frontaul section, it codelet extracts metadata such as the frame, slot, symbol, and PRB range, together with the compressed I/Q payload. The controller's worker decompresses the section into int16 I/Q samples, maps subcarriers to FFT bins, and encodes an indication containing the processed data.

**L1 operates after decompression, once the gNB has assembled a slot's resource grid.** It hook fires on the final symbol of each slot and gives the codelet read-only access to the completed grid. Because this payload is much larger, L1 places the samples in shared memory and puts only a reference to the slot in the E3 indication. Multiple dApps can then access the same stored samples without the payload being encoded separately into each indication. 

| **Aspect**       | **Spectrum SM**                           | **L1 SM**                                                      |
| :--------------- | :---------------------------------------- | :------------------------------------------------------------- |
| Capture point    | Fronthaul receive path                    | After the slot's resource grid is assembled                    |
| Data unit        | One fronthaul section                     | One complete slot                                              |
| Delivery to dApp | Processed I/Q samples in an E3 Indication | I/Q samples in shared memory; a reference in the E3 Indication |

​

A native jbpf helper converts the resource grid from bf16 to the fp16 row format required by the dApp and writes it to shared memory in **one copy**. The jbpf output channel carries only an approximately **64-byte descriptor** identifying the stored data. Thus, the L1 design avoids repeatedly carrying the large I/Q payload through the jbpf output channel and E3 messages; it does still copy the samples into shared memory.

## Subscriptions and Data Disribution

![](/img/blog/bringing-dapps-to-ocudu/image-58f2feed.png)

A subscription follows three phases: the controller loads the appropriate codelet and acknowledges the request; the codelet produces data that the controller sends as E3 Indications; and the controller unloads the codelet when the last subscriber unscribes.

The authors consider two separate scaling dimensions: **many dApps subscribing to one RAN function and one dApp subscribing to many RAN functions.** In the first case, the codelet captures each sample once and the worker processes it once, regardless of subscriber count. Distribution to subscribers is the part that grows with that count; its cost depends on whether the service model sends a payload or a reference to shared data.

In the second case, each data type has its own RAN function, codelet, `stream_id`, pipeline, and service model. A dApp subscribes separately to each function and can correlate their Indications using a common identifier. A pipeline exists only while its function has at least one subscriber.

Hook placement affects how independently these functions execute. Codelets attached to the **same hook run serially** in the RAN thread that invokes it. Hooks invoked by different RAN threads allow their codelets to execute independently, making hook placement an important design choice when adding data types.

## Minimal Footprint in OCUDU

The OCUDU integration consists of three groups of changes. First, it adds two jbpf instrumentation hooks: one in the OFH receive path and another in the upper-PHY symbol handler. The latter exposes a read-only view of the resource grid and fires on the final symbol of each slot.

Second, gNB startup initializes the jbpf agent and enables the LCM IPC server so the controller can load and unload codelets at runtime. Initialization also registers the helper functions used by L1 to attach to the shared-memory region and publish slot data. Third, a `jbpf:` YAML configuration specifies the IPC namespace, LCM socket path, and hugepage allocation size.

These changes are conditionally compiled. According to the authors, disabling jbpf support compiles out both hooks, leaving no runtime overhead from them.

# E3Controller Validation and Evaluation

Authors evaluate E3Controller in an O-RAN 7.2x deployment with an OCUDU gNB, a commercial radio unit, and a Samsung S23 user device. The evaluation uses the L1 service model because it carries the highest sustained data rate among the service models supported by the controller.

![](/img/blog/bringing-dapps-to-ocudu/image-70d648a4.png)

The authors compare four configurations: official OCUDU; their OCUDU fork with the jbpf hooks excluded from the build; and the full E3Controller and spectrum-sensing dApp setup using either ASN.1 or JSON Indications. Next section examines throughput and resource use; the subsequent section examines latency.

## Throughput and Energy Cost

![](/img/blog/bringing-dapps-to-ocudu/image-3546fef5.png)

The authors generate UDP traffic with `iperf3` for 60 seconds per run, targeting **500 Mbps downlink** and **100 Mbps uplink**, and repeat each run five times. Across the four configurations, measured throughput is approximately **490 Mbps downlink** and **72 Mbps uplink**. The distributions are nearly identical, so the authors report no measurable throughput penalty from enabling the E3 data path under these test conditions.

The additional data path still uses computing resources. With E3Controller and the dApp running, aggregate CPU occupancy rises from roughly **two cores to four cores**. The authors attribute most of this increase to the controller's poll, worker, and publisher threads, which continuously poll on dedicated cores to reduce scheduling delays.

The measured **dynamic power** rises by a few watts in the downlink configurations, while the uplink difference is smaller. ASN.1 and JSON produce similar throughput, CPU occupancy, and dynamic power in this evaluation. Thus, the result is a trade-off: **L1 I/Q delivery did not measurably reduce network throughput in the reported experiment, but it occupied substantially more CPU capacity.**

![](/img/blog/bringing-dapps-to-ocudu/image-050c1d95.png)

![](app://api/attachments/07AA9166-48D7-4174-AB52-2A62B8C0B061)

## E3Controller Latency

Authors measure the L1 service model's data path from the moment a jbpf hook fires inside OCUDU until an Indication is transmitted through libE3. The measurement ends at transmission; it does not include the dApp's subsequent processing time.

Across downlink and uplink traffic with either ASN.1 or JSON encoding, the median latency is approximately **115-120 μs**, with an interquartile range of about **10 μs**. The reported latency changes little with traffic direction or encoding choice.

![](/img/blog/bringing-dapps-to-ocudu/image-07e0e6d4.png)

To identify where the time is spent, the authors break the pipeline into stages. Resource-grid transfer and the shared-memory write dominate at approximately **69 μs**, because these stages convert and move I/Q payload. The publisher's E3AP encoding and transmission add about **24 μs**, while the dispatcher takes less than a microsecond.

![](/img/blog/bringing-dapps-to-ocudu/image-d8ea2389.png)

JSON takes approximately **3.6 μs** to encode the service-model message, compared with **1.2 μs** for ASN.1. This difference is small relative to the full delivery path. The measured stages total about **106 μs**; the authors attribute the remaining difference from the end-to-end median to queueing in libE3.

![](/img/blog/bringing-dapps-to-ocudu/image-fff281f7.png)

# Conclusion and Future Work

Authors present the first E3 integration for OCUDU. By combining lightweight hooks inside the gNB with an external E3Controller, their system gives dApps access to fronthaul and PHY data. In the reported experiments, high-rate I/Q delivery caused no measurable reduction in RAN throughput and remained within a sub-millisecond latency budget.

The authors propose extending the controller beyond data delivery so that dApps could dynamically add logic to RAN functions such as scheduling and PHY processing; this is future work, not a capability demonstrated in the paper.
