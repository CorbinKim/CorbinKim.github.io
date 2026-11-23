---
title: "FActScore"
date: "2026-11-23"
excerpt: "Evaluating Factual Precision One Claim at a Time"
tags: ["Language Models", "Factuality", "Long-form Generation", "Atomic Facts", "Fact Verification"]
---

- Authors: Min et al.
- Venue: EMNLP 2023

# 1. Research Problem

A long-form answer can contain a mixture of supported and unsupported information. A single correct-or-incorrect judgment hides that mixture, while checking every claim by hand is costly. Authors ask how to evaluate the factual precision of long-form language model outputs at a finer level and at a scale useful for comparing models.

The authors propose **FActScore**, which divides an answer into atomic facts and measures the proportion supported by a specified knowledge source. Their evaluation includes models that use search to generate answers and models that do not.

# 2. Methodology: From an Answer to Atomic Facts

## 2.1 Why Atomic Facts?

An atomic fact is a short statement containing one piece of information. The authors use facts rather than sentences because one sentence can contain both supported and unsupported claims; judging the sentence as a whole can obscure this difference.

For a response $y$, let $A_y$ be its set of atomic facts and $C$ the knowledge source used for verification. The response-level score is the proportion of facts supported by $C$.

$$
f(y)=\frac{1}{|A_y|}\sum_{a\in A_y}
\mathbf{1}[a\text{ is supported by }C].
$$

The paper also defines a model-level score. For a model $M$ and prompts $X$, it averages response-level scores **over prompts the model answers**:

$$
\operatorname{FActScore}(M)
=\mathbb{E}_{x\in X}\left[f(M(x))\mid M(x)\text{ responds}\right].
$$

The phrase "supported by $C$" is central: the score depends on the chosen knowledge source, rather than claiming to determine truth independently of any source.

## 2.2 Human Annotation

The authors sampled 183 people with Wikipedia pages and asked the evaluated models to generate biographies. Annotators divided each response into atomic facts, then used English Wikipedia to label relevant facts as **Supported** or **Not-supported**; they could also mark a fact **Irrelevant**.

The authors chose biographies because they contain specific, verifiable claims, and chose Wikipedia because it offers substantial coverage of those subjects.

# 3. Human Evaluation Results

The first experiment compares InstructGPT, ChatGPT, and search-using PerplexityAI. Table 1 reports both factual precision and characteristics of the models' responses.

| Model        | Search during generation | FActScore | Responses given | Atomic facts per response |
| :----------- | -----------------------: | --------: | --------------: | ------------------------: |
| InstructGPT  |                       No |     42.5% |           99.5% |                      26.3 |
| ChatGPT      |                       No |     58.3% |           85.8% |                      34.7 |
| PerplexityAI |                      Yes |     71.5% |           90.7% |                      40.8 |

PerplexityAI has the highest FActScore among these three systems, but it still produces unsupported information. Because the systems also differ in how often they answer and how many facts they generate, this table by itself does not isolate the causal effect of adding search. This is my interpretation of the comparison.

# 4. Estimating FActScore Automatically

Checking every atomic fact manually cost about \$4 per generation in the authors' study. To make larger evaluations practical, they built an estimator that splits responses into atomic facts and predicts whether each fact is supported by the knowledge source.

The paper examines several verification methods. One asks an evaluation language model to judge a fact without additional context; another retrieves relevant passages first. A combined method marks a fact as supported only when two verification methods agree.

Section 4.2 evaluates these methods by comparing their estimated FActScores with human scores and checking whether they preserve the ranking of the three evaluated systems. Retrieval generally helps the **evaluator**, although the best estimator varies with the system being evaluated.

| Outputs being evaluated | Best estimator reported for that system | Error rate |
| :---------------------- | :-------------------------------------- | ---------: |
| InstructGPT             | Inst-LLAMA, retrieval + NP              |      1.4 % |
| ChatGPT                 | Inst-LLAMA, retrieval + NP              |      0.4 % |
| PerplexityAI            | ChatGPT, retrieval → LM                 |      0.8 % |

Selected the lowest error rates from Table 3 in this paper; the error rate measures the difference between the estimated and human FActScores.

The retrieval in this section belongs to the **evaluation process**; the model whose answer is being scored does not have to use retrieval.

# 5. Evaluating More Models

The authors then used automatic evaluation on 6,500 biographies from 13 subjects, including 12 language models and human-written biographies. The two recommended estimator variants produced strongly correlated scores across this comparison, with a reported Pearson correlation of 0.99.

![](/img/blog/factscore/image-29a00fca.png)

The authors report that GPT-4 and ChatGPT were close in factual precision, while GPT-4 responded more often and produced more atomic facts per response. They also report substantial variation among the publicly available models.

# 6. Assessment

FActScore’s main contribution is its choice of the atomic fact as the unit of evaluation. It can distinguish a partly supported answer from one with fewer supported claims, and its automatic estimator makes this kind of evaluation practical across many model outputs.

The evidence for the method comes primarily from biographies evaluated against Wikipedia, so its performance in other domains depends on having a suitable knowledge source. The automatic estimator can also make mistakes on individual facts. More fundamentally, FActScore measures the precision of facts a model states, not whether it includes all the facts an answer needs: a model may score well by giving a short answer or declining to answer. The authors therefore recommend reporting response rate and the average number of atomic facts alongside FActScore.
