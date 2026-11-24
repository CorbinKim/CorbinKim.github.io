---
title: "TSVer"
date: "2026-11-24"
excerpt: "Evaluating Fact Verification Against Time-Series Evidence"
tags: ["Fact Verification", "Time series", "Evidence retrieval", "Explanation evaluation"]
cover: "/img/blog/tsver/screenshot-2026-11-24-at-4-22-13-pm-96fbe148.png"
---

- Authors: Strong et al.
- Venue: EMNLP 2025

# 1. Research Problem

A claim about a numerical trend may depend on which time series is used and which period is examined. A fact-verification system must therefore identify relevant data, select the appropriate time range, reach a verdict, and explain how the evidence supports it.

**TSVer** is a benchmark for evaluating that sequence of decisions. Its explanations justify verdicts about claims using historical time-series evidence; the benchmark does not evaluate explanations of time-series forecasts.

# 2. Dataset and Evaluation Task

The dataset contains **304 real-world claims** collected from **41 fact-checking organizations** and a curated collection of **400 time series**. Claims are annotated with relevant evidence periods, a verdict, and a written justification. The four verdict classes are *SUPPORTS, REFUTES, NOT ENOUGH INFO*, and *CONFLICTING EVIDENCE/CHERRY-PICKING*; REFUTES represents 53.95% of the claims. Figure 1 illustrates the evaluation unit: a claim is paired with time-series evidence, selected periods, a verdict, and a justification.

![](/img/blog/tsver/image-3751e0be.png)

The dataset construction process first collects and filters claims, extracts time series, and pre-aligns likely evidence; human annotators then select relevant series and periods before another group assigns verdicts and writes justifications. Figure 2 shows this pipeline.

![](/img/blog/tsver/image-69c29d46.png)

# 3. Why the Evaluation has Three Parts

The baseline system retrieves relevant time series, narrows them to pertinent countries and periods, and then prompts an LLM to generate a **verdict and justification** from the selected data. The paper evaluates three different outputs of that process.

| Output                        | Metric                                | Question answered                                                          |
| :---------------------------- | :------------------------------------ | :------------------------------------------------------------------------- |
| Verdict                       | Accuracy and macro-F1                 | Did the model assign the correct verdict?                                  |
| Selected time-series evidence | **Time Series Coverage Score (TSCS)** | Did it select the right series and relevant periods?                       |
| Written justification         | **Ev2R** and METEOR                   | How well does its explanation align with a human reference justification?  |

These scores should be interpreted separately: a correct verdict dose not establish that the model used the right evidence or explained its decision accurately. This is the motivation for examining the paper's evaluation metrics individually.

# 4. Evaluation Metrics

## 4.1 Verdict accuracy and macro-F1

Accuracy measures agreement between predicted and annotated verdicts, while the paper also reports macro-F1 for the four-class verdict task. Reporting macro-F1 is useful here because the classes are unbalanced: REFUTES alone accounts for 53.95% of the dataset. Neither verdict metric measures whether the model selected the correct time-series evidence or wrote a well-supported justification.

## 4.2 Time Series Coverage Score: evidence selection

TSCS is the paper's time-series-specific retrieval metric. For each evaluation instance, it combines an F1 score for selecting the correct time-series datasets with a temporal Jaccard index for how well the retrieved periods overlap the annotated periods. The paper defines:

$$
\mathrm{TSCS}
=
\frac{1}{N}
\sum_{i=1}^{N}
\left(F1_i\cdot\bar{J}_i\right)
\tag{1}
$$

$$
\bar{J}
=
\frac{1}{T}
\sum_{j=1}^{T}
\frac{|\hat{Y}_j\cap Y_j|}
     {|\hat{Y}_j\cup Y_j|}
\tag{2}
$$

Here, $N$ is the number of evaluation instances. For instance $i$, $F1_i$ measures whether the correct time-series datasets were retrieved, while $\bar{J}_i$ is the average temporal Jaccard index over the matched datasets. In Equation (2), $T$ is the number of matched time series, $\hat{Y}_j$ is the annotated time range, and $Y_j$ is the retrieved time range.

The multiplication in Equation (1) means that identifying a relevant series and identifying its relevant period both matter. TSCS is therefore a measure of **evidence selection**, not of forecast error, verdict correctness, or explanation prose.

## 4.3 Ev2R: justification quality

For generated justifications, the authors adapt the **reference-based atomic score from Ev2R**, a metric originally designed to compare retrieved and reference evidence. It decomposes free-form text into atomic facts and measures factual support in both directions. Using the paper's notation, $\hat{E}$ denotes the evaluated text and $E$ the reference text:

$$
s_{\mathrm{prec}}
=
\frac{1}{|A_{\hat{E}}|}
\sum_{a_{\hat{E}}\in A_{\hat{E}}}
\mathbb{I}\!\left[a_{\hat{E}}\text{ supported by }E\right]
\tag{3}
$$

$$
s_{\mathrm{recall}}
=
\frac{1}{|A_E|}
\sum_{a_E\in A_E}
\mathbb{I}\!\left[a_E\text{ supported by }\hat{E}\right]
\tag{4}
$$

$$
s_{F_1}
=
\frac{2s_{\mathrm{prec}}s_{\mathrm{recall}}}
{s_{\mathrm{prec}}+s_{\mathrm{recall}}}
\tag{5}
$$

Precision asks whether facts stated in the generated justification are supported by the human justification. Recall asks whether facts in the human justification are covered by the generated one. Their harmonic mean is the reported atomic-fact score. The authors adapt the scorer's prompt with examples from their development set and use `gemini-2.5-flash-preview-09-2025` as the scoring model.

Ev2R is reference-based in this application. Its score measures alignment with a human-written justification; it does not, by itself, directly re-compute every claim from the raw time-series values.

## 4.4 METEOR: a comparison metric

The paper also reports METEOR for justifications as a measure of surface-level lexical overlap with the reference text.
15
The authors argue that this overlap is less informative about factual adequacy than atomic-fact comparison: Llama-3.1-8B and GPT-5.2 have relatively similar METEOR scores, 27.64 and 26.14, but markedly different Ev2R scores, 25.07 and 46.51.

# 5. Evaluation Results

Table 2 reports the metrics side by side; the selected figures below reproduce the paper’s reported scores, without treating scores from different metrics as interchangeable.

| Model          |  TSCS | Verdict macro-F1 | Verdict accuracy | METEOR |  Ev2R |
| :------------- | ----: | ---------------: | ---------------: | -----: | ----: |
| Gemini-2.5-Pro | 27.87 |            54.10 |            63.57 |  30.26 | 47.36 |
| GPT-5.2        | 25.83 |            52.63 |            62.86 |  26.14 | 46.51 |
| Llama-3.1-8B   |  3.19 |            24.46 |            23.21 |  27.64 | 25.07 |

The gap between Llama-3.1-8B’s METEOR and Ev2R results illustrates the authors’ central evaluation argument: similar wording overlap need not indicate similar factual alignment with a reference justification. The much lower TSCS for that model identifies a separate difficulty in finding relevant series and periods; the paper reports substantial over-retrieval and context-length errors for smaller models.

# 6. Assessment

TSVer’s main contribution is to make **time-series selection, temporal alignment, verdict prediction, and written justification** independently measurable within one fact-verification benchmark.
TSCS is the distinctive metric for assessing whether a system selected the right time-series evidence and periods, while Ev2R assesses generated explanations against human reference explanations.

These measurements have different evidential limits: **TSCS requires annotated relevant series and periods**, and **Ev2R depends on the content of the human reference justification**.
Because TSVer’s task is verifying claims against historical time series, its reported scores establish performance on that task rather than on forecasting or explaining forecast outputs
