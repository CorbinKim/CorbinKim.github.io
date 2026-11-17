---
title: "NORIA-O"
date: "2026-11-17"
excerpt: "An Ontology for Anomaly Detection and Incident Management in ICT Systems"
tags: ["Ontology", "Network Supervision", "Incident Management", "Network Infrastructure", "NORIA"]
cover: "/img/blog/noria-o/screenshot-2026-11-17-at-12-29-25-am-0f31d118.png"
---

- Authors: Lionel Tailhardat et al.
- Venue: ESWC 2024, The Semantic Web

# 1. Research Problem

&#x20; Diagnosing an incident in a large ICT system requires more than identifying the device that raised an alarm. Operators may also need to know which services depend on that device, what other events occurred, whether a recent change could be relevant, and who is responsible for the affected resources. This information is often distributed across different technologies, management systems, and teams.

Existing semantic models cover parts of this domain, but the authors identify a gap in representing detailed network topology together with network activity and day-to-day operations. They propose **NORIA-O** to describe infrastructure, events, incidents, and operational actions within a shared semantic model.

The paper develops the ontology from questions collected from domain experts, evaluates whether the resulting model can answer those questions, and illustrates its use with a fictitious network incident.

# 2. Methodology: From Competency Questions to a Conceptual Model

## 2.1 Collecting Competency Questions

The authors worked with 16 experts in network and data-center engineering, operations, monitoring, and incident management. Through several rounds of review, the experts agreed on 26 competency questions - questions the ontology should be able to support.

The questions cover topics such as the resources affected by an incident, logs and alarms originating from a resource, the sequence of events leading to an incident, its root cause, and the actions taken to resolve it. The authors then mapped these natural-language questions to concepts and relationships. For example, a question asking which resource, application, or site is associated with an incident implies concepts for Asset and Incident, together with a relationship between them.

The CQs serve two purposes in the paper: they guide the conceptual design and later provide the basis for testing whether the implemented ontology supports the experts' information needs.

## 2.2 Four Facets of the Domain

NORIA-O organizes its domain into four facets.

| Facet      | What it describes                                                      |
| :--------- | :--------------------------------------------------------------------- |
| Structural | Physical and logical resources, their locations, and their connections |
| Functional | Applications, services, and the functions provided by resources        |
| Dynamic    | Events, their timing, and their order                                  |
| Procedural | Operational rules, changes, and response procedures                    |

For instance, an alarm raised by a switch belongs to the dynamic facet. The switch and its links belong to the structural facet; the affected service belongs to the functional facet; and the repair action belongs to the procedural facet. Reading these facets together provides a way to describe the context surrounding an incident. This is my interpretation of how the paper's four facets fit together.

![](/img/blog/noria-o/image-d74b2e53.png)

## 2.3 Formalization and Reuse

The authors primarily use RDFS to express class hierarchies and use OWL where additional logical structure is needed, such as class disjointness or property qualifications. The implemented ontology contains **59 classes**, **107 object properties**, and **71 datatype properties**.

NORIA-O also reuses and aligns with existing models. For example, **BOT** supports spatial description of resources; **SEAS** and **PEP** support descriptions of technical systems and operations; and **FOAF** and **ORG** support descriptions of people and organizations. The authors use SKOS-based controlled vocabularies to reconcile terminology from heterogeneous ICT systems. Terms such as `active`, `up`, `enabled` can refer to a shared concept when different devices use them for a similar interface status.

The ontology does not impose a single representation for every observation. The authors propose strings or controlled-vocabulary concepts for invariant properties, and instances for time-dependent observations or extensions specific to a use case.

# 3. The Main Components of NORIA-O

This section introduces the ontology's principal classes and properties. I found it useful to read them as four connected groups: **resources and services, event records, incident-management records, and responsible agents.**

![](/img/blog/noria-o/image-d336d21a.png)

## 3.1 Resources, Network Connections, and Applications

The **Resource** class represents a manageable physical or logical entity in the network. Its properties can describe a resource's type, product model, identifier, hostname, and installation date; the paper gives racks, servers, routers and virtual machines as examples of resource types.

The model describes location in two ways. Spatial relationships from BOT can locate a resource within a site and room, while `seas:subSystemOf` can express component relationships - for example, a hard drive within a server or a server within a rack. **NetworkInterface** and **NetworkLink** represent interfaces and connections, allowing the ontology to describe network topology as well as operational properties such as interface status and routing priority.

The functional side of the model uses **Application**, **ApplicationModule**, and **Service**. An Application describes the purpose of a set of resources; an ApplicationModule is a concrete instance of that model; and a Service groups application modules. Together, these concepts relate the network's resources and connections to the function they provide.

## 3.2 Logs and Alarms

The **EventRecord** class represents events emitted by managed objects, including system logs, SNMP traps, and application-specific messages. Properties such as `loggingTime`, `logText`, `logOriginatingManagedObject`, and `logOriginatingManagementSystem` record when an event was logged, what it says, and where it came from.

The `dcterms:type` property associates an event with a controlled-vocabulary concept such as a state change, processing-error alarm, or integrity violation. The `alarmSeverity` property describes the perceived seriousness of an alarm's effect on a managed object or service. Additional relationships can group related events and connect them to event signatures, root-cause analysis, repair planning, or responsibility tracking.

This design makes the event's **origin**, **meaning**, and **relationships** available for queries, alongside the original log text.

## 3.3 Trouble Tickets and Change Requests

A **TroubleTicket** is a record used to track an issue and coordinate restoration work; it is not itself the event that occurred. Corrective actions can be recorded as **TroubleTicketNote** instances linked to the parent ticket. The model can also connect an action to its responsible agent and to digital traces, such as a login or configuration-change EventRecord.

The authors include properties for grouping tickets, categorizing problems, and relating corrective actions to a more general **OperationPlan**. A **ChangeRequest** records\*\*\*\* scheduled changes. By relating changes to affected resources and applications and to their start and end times, the model supports investigation of a potential causal connection between a change and a subsequent trouble ticket.

## 3.4 Agents, Teams, and Organizations

Incident management also depends on finding the right people. NORIA-O uses **FOAF** and **ORG** to represent individuals, organizational units, and organizations, and relates them to resources and application modules through management and responsibility properties.

The authors also define a **CorporateUserIdentifier** class and controlled terms for roles such as technical support groups and manufacturers. These relationships can be used to examine whether an observed user action falls outside the access groups defined in the model, although the paper presents this as an analytical use of the data rather than an access-control mechanism implemented by the ontology itself.

# 4. Evaluation

The evaluation asks whether NORIA-O can support the **26 competency questions** collected during development. The authors translated the questions into SPARQL-based authoring tests and ran them against two knowledge graphs structured by the ontology.

One graph represents a publicly available fictitious supervision scenario. The other was constructed from Orange's internal data: **10 data sources** with **128 features across 15 tables**, yielding approximately **4 million RDF triples and 400,000 entities**; its streamed events span 111 days.

The authors report three outcomes:

1. 16 of 26 CQs could be answered using the ontology and one or more relatively simple SPARQL queries.
2. 9 of 26 CQs could be answered only partially with SPARQL and would require complementary AI techniques for a complete answer.
3. 1 of 26 CQs, concerning the financial cost of an incident, would require an extension of the ontology.

The root-cause question illustrates the second category. NORIA-O can represent alarms and logs associated with an incident, but answering *what caused it* requires an additional root-cause analysis method. These results therefore assess **coverage of the experts' questions**, not anomaly-detection accuracy or automatic repair performance.

# 5. Use Case

The paper illustrates the model with a fictitious failure of an **access switch**. The failure affects redundancy for resources supporting a critical application. A technician identifies the problem through an inferred alert, traces it to the faulty equipment, performs a corrective action, and records the cause and repair in a trouble ticket. The full scenario, including additional resource, organization, and root-cause details, is represented with **660 RDF triples**.

![](/img/blog/noria-o/image-8f23a2c4.png)

The authors use this example to demonstrate data integration, queries across the model's facets, and navigation through the graph around an incident. They describe how a SPARQL graph pattern could derive an alert about lost redundancy and how queries could identify nearby network elements or the teams involved in resolving the incident. Event-pattern classification and root-cause analysis are discussed as tasks that can combine NORIA-O with complementary ontologies, rule engines, or graph embeddings.

# 6. Assessment

The paper's clearest contribution is the **joint representation of network structure, service function, events, response actions, and responsible parties**. Its competency-question process also gives the design an explicit connection to the information operators want to retrieve.

The evaluation supports the claim that much of this information can be queried within the proposed model: 16 CQs were answerable with SPARQL, while nine needed additional techniques and one needed an ontology extension. My reading is that **NORIA-O provides a shared semantic foundation for incident analysis**. Its value lies in making relevant data and relationships available together; the paper's own results show that determining a root cause still requires methods beyond the ontology.
