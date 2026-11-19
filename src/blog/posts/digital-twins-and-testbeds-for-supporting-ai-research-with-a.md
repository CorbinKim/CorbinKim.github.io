---
title: "Digital Twins and Testbeds for Supporting AI Research with Autonomous Vehicle Networks"
date: "2026-11-19"
excerpt: ""
tags: ["Wireless networks", "Trajectory", "Digital twins", "Artificial intelligence", "Autonomous vehicles"]
cover: "/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/screenshot-2026-11-19-at-4-07-14-pm-71dd6e5c.png"
---

- Authors: Gürses et al.
- Venue: IEEE Communications Magazine, 2025

# Introduction

## Background and motivation

Autonomous vehicle networks (AVN) must adapt vehicle trajectories and wireless network settings as conditions change. Developing AI for these decisions requires repeated tests of how vehicle movement, radio propagation, and network software interact. Physical experiments provide realistic observations, but operating vehicles and collecting enough data for AI development can be costly and time-consuming.

A digital **twin (DT)** provides a virtual environment for this work. The authors emphasize two connections: **physical-to-virtual (P2V)**, which brings observations from the real environment into the DT, and **virtual-to-physical (V2P)**, which transfers software developed in the DT to the real system. Accurately representing three-dimensional radio propagation is a particular challenge for AVNs.

## Approach of the paper

The paper compares four environments for developing AI-aided AVNs: simulations, DTs, sandboxes, and physical testbeds (PTs). It then introduces the AERPAW platform and examines a case in which a UAV estimates the location of a ground vehicle from received signal strength. The case study asks how well methods developed in a virtual environment work with real measurements, and what changes when real-world data is used for calibration.![](app://api/attachments/218DF8D3-B4D7-4DFD-A2D7-E009EDD28EB5)

![](/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/image-dc932757.png)

# Development Environments for Autonomous Vehicle Networks

## From simulation to physical testing

| **Environment**      | **Role in the development process**                                                   |
| :------------------- | :------------------------------------------------------------------------------------ |
| **Simulation**       | Simplifies system components to study selected behavior and generate development data |
| **Digital twin**     | Connects vehicle and radio software to emulators so their interactions can be tested  |
| **Sandbox**          | Combines real hardware with a channel emulator or an isolated RF environment          |
| **Physical testbed** | Tests the system outdoors and collects measurements for validation and calibration    |

The distinction between simulation and a DT matters here. A simulation uses simplified models, so software developed for it cannot necessarily be deployed directly in the real system. The DT considered by the authors runs vehicle and radio software with software-in-the-loop (SITL) emulators; software containers can then move to sandbox and PT environments for further testing.

A DT still depends on the accuracy of its emulated environment. The authors propose using PT measurements to tune models of the wireless channel, vehicle movement, and other conditions. The PT is valuable for final validation and data collection, but its operational demands make it less suitable for the many repeated experiments needed to train AI models.

![](/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/image-f71048dd.png)

![](app://api/attachments/57124D57-A53C-4C95-B4F6-6EED93C6962A)

# Example Uses of AI with Digital Twins

The paper discusses several applications in which a DT could support joint development of vehicle trajectories and wireless network settings. These include UAV routes for sensor data collection, restoring connectivity after disasters, search and rescue, and detecting or tracking unauthorized UAVs and other signal sources.

The authors also discuss federated learning and over-the-air computation, beam prediction and tracking for mobile links, and the use of UAVs to extend network coverage. These are illustrative use cases; the paper's detailed experimental case concerns signal-source localization on AERPAW.

![](/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/image-fcde277f.png)

![](app://api/attachments/E3D739E0-1210-47DF-BB3D-7F8E3621DF62)

# AERPAW: Connecting the Digital Twin to a Physical Testbed

AERPAW combines a virtual development environment with outdoor wireless experiments. An experimenter specifies the mobile nodes, such as UAVs and UGVs, and fixed nodes, such as base stations. The platform then starts Docker containers and DT components, including vehicle and channel emulators. The development flow proceeds from initial testing in the DT to sandbox testing with a channel emulator and final testing in the PT.

A typical experiment contains radio, vehicle, and application software. AERPAW uses a SITL vehicle emulator, a virtual radio hardware stack, and an I/Q channel emulator so that the same software components can run in the DT and PT. Measurements collected in the PT can subsequently inform another round of DT and AI-model development.

The need for that feedback becomes clear in the paper's received signal strength (RSSI) comparison. The simulator and DT show similar signal-loss patterns, while the real-world measurements contain many deep fades. Training solely on the virtual environment can therefore leave a localization method unprepared for the propagation effects it encounters outdoors.

# Case Study: AI-Aided Signal-Source Localization

## Task and localization methods

The case study draws on AERPAW's Find-a-Rover challenge. A UAV uses the strength of a **125 kHz narrowband signal** transmitted by a UGV to estimate the UGV's position. The authors report that UAV orientation and tilt, together with complex three-dimensional propagation, can produce deep fades on the order of **up to 60 dB** during flight.

One team first generated a large signal-strength dataset with a simulator based on a two-ray path-loss model that accounts for antenna radiation patterns. The paper presents two localization methods developed for this setting.

- **Particle filter (PF)**: Candidate UGV positions are represented by particles. At each UAV position, the method compares measured RSSI with the RSSI predicted for each particle, updates their weights, and uses the weighted positions to estimate the source location.
- **Finger-CNN**: UAV positions and RSSI measurements form a two-dimensional input. The model classifies which cell of a divided search area contains the UGV, using three convolution and max-pooling stages before its classification layer.

The Finger-CNN dataset was divided into **70 percent training, 15 percent validation, and 15 percent testing**, and the model was trained for 200 epochs. This case study evaluates localization; it does not evaluate real-time optimization of the UAV's trajectory.

# Results and Discussion

## The gap between virtual and real-world performance

The authors compare localization errors in three trials: two with the UGV inside the UAV flight area and one with the UGV outside it. They examine three conditions: development and testing in the DT; development in the DT followed by real-world testing; and development with real-world calibration followed by testing on real-world logs.

When the methods developed without real-world calibration were tested outdoors, localization errors were high because the virtual environment had not accounted for the observed channel effects. Finger-CNN performed well in the two trials inside the flight area but struggled with the outside-area trial, for which its training data was insufficient.

The authors then used real-world logs from challenge teams to adjust the simulator and redevelop the methods. In the resulting third condition, the PF handled the RSSI offset better, Finger-CNN generalized better to the outside-area trial, and the reported localization errors fell. The case illustrates a practical role for the DT: physical measurement must feed back into the virtual environment before performance there can reliably guide real-world deployment.

![](/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/image-4874be91.png)

![](/img/blog/digital-twins-and-testbeds-for-supporting-ai-research-with-a/image-dac245c1.png)

![](app://api/attachments/F41096DE-8DCF-4BA4-95BA-7287FE755893)

# Conclusion and Future Work

The authors present an iterative development flow: use simulation to support data generation and model tuning, develop and test software in a DT, then use PT measurements to calibrate and validate it. In the AERPAW localization case, the lower errors after real-world calibration show why the P2V connection is central to that process.

The authors identify developing more complex AI methods in the DT, including federated learning and over-the-air computation, and integrating them into AERPAW for further testing as future work.

​
