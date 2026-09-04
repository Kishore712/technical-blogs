---
layout: post
title: "The Partition Key That Broke Production"
date: 2026-09-03
reading_time: "12 min read"
tags: [Distributed Systems, Database, System Design, Partition Key]
excerpt: "How a single design decision in a document database can silently break your system under load — what partition keys actually do, why hot partitions happen, and how to design keys that scale."
---


## The Scenario

Imagine you're running a multi-tenant SaaS platform. Thousands of customers share the same database infrastructure. Everything has been running smoothly for months.

Then one night, something changes.

A handful of your biggest customers start running heavier workloads. Maybe they're importing large datasets, running automated pipelines, or just growing fast. Their usage is 100x to 1,000x higher than your average customer.

And suddenly, things start breaking — but only for *some* users.

Your biggest customers see requests timing out, responses taking in the range of few seconds, and intermittent errors. Meanwhile, the rest of your customers are fine. Your monitoring dashboards show the overall system looks healthy. CPU is normal. Memory is fine. The service itself isn't crashing.

So what's going on?

The answer, in this case, was hiding inside a single design decision made months earlier: **the partition key**.

This post will explain what partition keys are, why they matter more than most teams realize, how a bad one can silently break production, and what a better design looks like.

Whether you work with Cosmos DB, DynamoDB, MongoDB, Cassandra, or any distributed document database, the concepts here apply broadly.

---

## What Is a Partition Key?

Before diving into what went wrong, let's make sure the concept itself is clear.

A **partition key** is a field in your data that tells the database *where to physically store each record*. When you insert a document, the database looks at the partition key value and uses it to decide which internal storage bucket (called a **logical partition**) the document belongs to.

Think of it like organizing a library.

![Partition keys are like organizing a library](/technical-blogs/assets/images/posts/partition-key/01_bookshelf_analogy.png)

Without a partition key, all your data goes into one big pile. Finding anything means scanning through everything. With a good partition key, the data is neatly organized on labeled shelves — and the database can go straight to the right shelf without searching.

This sounds simple, but the choice of partition key affects almost everything about how your database behaves at scale:

- **Write distribution** — are writes spreading evenly, or piling up in one place?
- **Read efficiency** — can the database find data without scanning broadly?
- **Tenant isolation** — can one noisy customer starve everyone else?
- **Scalability** — can the database add capacity smoothly as you grow?

A partition key is not just a lookup field. It is a **load-balancing strategy encoded into your data model**.

---

## How Partition Keys Work Under the Hood

Here's where it gets interesting.

Your partition key values create **logical partitions** — these are your data's organizational buckets. But the database engine groups those logical partitions into **physical partitions**, which are the actual server-side storage units with real hardware behind them.

Each physical partition has a **fixed throughput budget**. In Cosmos DB, this is measured in Request Units per second (RU/s). In DynamoDB, it's Read/Write Capacity Units. The concept is the same everywhere: each physical partition can only handle so much work per second.

![How partition keys map to physical storage](/technical-blogs/assets/images/posts/partition-key/02_partition_mapping.png)

Here's the critical insight:

**You don't control which physical partition your data lands on.** The database engine manages that mapping. What you *do* control is the partition key — and that determines how evenly your data and traffic spread across those physical partitions.

If your partition key produces a small number of heavily-used values, traffic concentrates on a few physical partitions. If it produces a large number of well-distributed values, traffic spreads evenly.

This distinction is the entire ballgame.

---

## The Problem: Hot Partitions

Now back to the scenario.

The SaaS platform stored its data using a simple, flat partition key — something like `/entity_id`. The key was derived from the record's identity and used consistently across related documents.

On paper, it looked perfectly reasonable. It gave predictable routing, kept related data together, and made individual lookups fast. Under testing with balanced traffic, it performed well.

But production traffic was not balanced.

A handful of large tenants produced dramatically more write traffic than everyone else. Because the partition key didn't account for tenant identity, all of a big tenant's activity landed on whichever physical partitions happened to hold their data. Those partitions hit their throughput ceilings while other partitions sat mostly idle.

![The hot partition problem](/technical-blogs/assets/images/posts/partition-key/03_hot_partition.png)

This is the **hot partition problem**, and it's one of the most common (and most painful) failure modes in distributed databases.

The symptoms are deceptive:

- **Total capacity looks healthy.** The container-wide metrics show plenty of headroom.
- **A few specific tenants are failing.** Their requests get throttled (HTTP 429 errors), time out, or take seconds instead of milliseconds.
- **Everyone else is fine.** Fleet-wide averages hide the problem because the suffering is concentrated.

The database isn't broken. It's doing exactly what it was designed to do. The data model is the bug.

### Why this catches teams off guard

The trap is that flat partition keys work perfectly well under average load. If every tenant produces similar traffic, the distribution is even and nothing overheats.

The problem appears only when you have **skewed, multi-tenant traffic** — and that skew often shows up gradually. A small customer becomes a big customer. An automated workflow ramps up. A seasonal burst hits. By the time the hot partition surfaces, you're already in an incident.

> **"Works well under average load" is not the same thing as "works well under skewed multi-tenant load."**

---

## Why "Just Add More Capacity" Doesn't Fix It

When a system is throttling, the first instinct is to scale up. Give the database more throughput. In Cosmos DB, that means increasing provisioned RU/s. In DynamoDB, it means raising WCU/RCU limits.

And it does help — briefly.

When you increase total throughput, each physical partition gets a proportional share of the new budget. The hot partitions get a bit more room to breathe. Latency might drop. Error rates might dip.

But the underlying distribution hasn't changed.

The same tenants are still hitting the same partitions. The same imbalance is still there. You've just made it temporarily more expensive to be unbalanced.

![Why adding more capacity doesn't fix a hot partition](/technical-blogs/assets/images/posts/partition-key/04_scaling_doesnt_help.png)

Look at what happens: you doubled the total capacity (and doubled the cost), and yes, the hot partitions now fit within their budgets. But four of the six partitions are barely used. You're paying for capacity that's sitting idle because the traffic doesn't reach it.

> **More total throughput does not redistribute a bad key. If the traffic remains uneven, you're just making an imbalanced system more expensive.**

This is the moment you have to stop treating it as a capacity problem and start treating it as a design problem.

---

## The Fix: Designing a Better Partition Key

The real fix is to change the partition key so that traffic distributes more evenly — especially for your biggest tenants.

The technique that solves this is a **hierarchical partition key** (sometimes called a composite or compound key). Instead of a single flat value, you use a multi-level key that encodes both the tenant dimension and a sub-partition dimension.

### Flat key vs. hierarchical key

Here's the core difference:

**Flat key: `/entity_id`**
All documents for a big tenant may hash to the same physical partition. One busy tenant can overwhelm that partition.

**Hierarchical key: `[tenant_id, sub_key]`**
The tenant's data is first grouped by tenant (so tenant-scoped queries stay efficient), then subdivided within that tenant (so a big tenant's writes spread across multiple logical partitions).

![Flat vs. hierarchical partition keys](/technical-blogs/assets/images/posts/partition-key/05_flat_vs_hierarchical.png)

### Why this works

The hierarchical key solves the problem in two complementary ways:

1. **Tenant prefix for query routing.** With `tenant_id` as the first level, any query scoped to a single tenant can be routed precisely — no fan-out across unrelated tenants. This makes operations like "list all records for tenant X" or "export tenant X's data" efficient.

2. **Sub-key for write distribution.** The second level (`sub_key`) increases the number of logical partitions *within* each tenant. A tenant with 100,000 documents is no longer crammed into one hot partition. Their data spreads across many logical partitions, and the database can map those to different physical partitions.

The sub-key can be derived from the record's own identity (a hash, a category, a timestamp bucket — whatever produces good cardinality for your workload). The important thing is that it creates enough distinct values for your largest tenants to avoid concentration.

### What this preserves

A well-designed hierarchical key doesn't sacrifice locality. Related records can still live near each other if the sub-key is chosen carefully. Point reads (where you know both key levels) remain fast. Tenant-scoped queries stay targeted.

You're not giving up data organization. You're adding load distribution *within* that organization.

---

## What Improves When You Get the Key Right

Fixing a hot partition problem by switching to a better key doesn't change the workload — the same traffic still arrives. What changes is how the system absorbs it.

Here's the general pattern you can expect:

**Tail latency drops dramatically.** The requests that were stuck behind a throttled partition — the ones taking seconds instead of milliseconds — go back to normal. This is the most visible improvement and the one your users will feel immediately.

**Throttling disappears from the hot spots.** Instead of two partitions pegged at their ceiling while four sit idle, the load spreads across all of them. The database can finally use the capacity you're paying for.

**Error rates for your busiest workloads collapse.** The timeouts and 429s that were concentrated on a few heavy hitters drop to near zero. The system stops punishing your most active users.

**Median latency may get slightly worse.** This one surprises people. A hierarchical key adds a small amount of overhead for every request — an extra level of routing, a slightly wider logical partition space. You might see a few extra milliseconds on the median. That's a trade-off worth making, because those few milliseconds in the happy path buy you *seconds* of relief in the worst case.

This is a pattern experienced engineers recognize: **optimize for the system that doesn't melt under stress, not for the best-possible median under ideal conditions.**

The goal of a good partition key isn't "no spikes." It's a system that absorbs spikes instead of folding under them.

---

## How to Choose a Good Partition Key

The partition key decision deserves more thought than most teams give it. Regardless of what kind of system you're building, the same core principles apply.

![Partition key decision checklist](/technical-blogs/assets/images/posts/partition-key/07_decision_checklist.png)

### The three forces

Every partition key decision is a balancing act between three forces:

**1. Write distribution — will writes spread evenly?**
This is the most common source of pain. If your key funnels a large share of writes into a small number of partitions, you'll hit hot partition problems under load. The key needs to produce enough distinct values that traffic doesn't pile up.

**2. Read locality — can the database find data without scanning everywhere?**
A key that distributes perfectly but has no relationship to your query patterns forces the database to fan out every read across all partitions. That's expensive and slow. Your most common queries should be able to target a specific partition or a narrow range.

**3. Operational alignment — does the key support the work you actually do?**
Beyond reads and writes, think about exports, migrations, cleanups, and debugging. If your key makes it hard to answer "give me all records for entity X" or "delete everything older than 90 days within scope Y," you'll feel that pain in operations tooling and incident response.

A great partition key finds a sweet spot across all three. Optimizing for only one of these usually hurts the other two.

### Five properties of a good partition key

**High cardinality.** A partition key that produces only 10 distinct values creates at most 10 logical partitions. That's a hard ceiling on your parallelism. A key that produces tens of thousands of distinct values gives the database far more room to distribute work. When in doubt, err on the side of more cardinality.

**Stable values.** Partition keys are typically immutable — changing a document's key means deleting and re-creating it (or migrating to a new container entirely). Choose a field that won't change over the record's lifetime. A user's ID is stable. A status field (`pending` → `complete`) is not.

**Aligned with your hottest access pattern.** Look at your top 3-5 queries by volume. If most of your reads are scoped to a specific entity, group, or category, that scope probably belongs in your key. A key that makes your most common query a single-partition read is worth a lot.

**Aware of workload shape.** "What does the data look like?" is a different question from "how does the traffic behave?" A key that works under uniform load can break under skewed load — where a small number of entities produce a disproportionate share of the traffic. Design for your busiest entity, not your average one.

**Composite when needed.** If no single field satisfies all the properties above, consider a hierarchical or composite key. A two-level key like `[scope, sub_key]` lets you group related data at the first level (for query locality) and spread it at the second level (for write distribution). This is the pattern that solved the incident described earlier in this post.

### Common partition key mistakes

| Mistake | Why it hurts |
|---|---|
| Using a timestamp as the key | All current writes land on the same "latest" partition — hot partition guaranteed |
| Using a low-cardinality field (`status`, `type`, `region`) | Only a handful of partitions exist — severe concentration under load |
| Using a field that doesn't exist on all documents | Documents without the key land in a null partition — another hot spot |
| Using a field that changes over the record's lifetime | Partition keys are typically immutable; changing them means migrating data |
| Using a truly random key (UUID) | Excellent distribution, but no query locality — every query fans out everywhere |
| Choosing without looking at traffic patterns | A key that looks clean on a schema diagram may perform terribly under real workload skew |

---

## Best Practices for Partition Key Design

### 1. Test with skew, not averages

If your test traffic is perfectly uniform, it will never reveal the hot partition problem — the exact problem that finds you in production. Load tests should include realistic skew: a few entities much busier than the rest, burst patterns, and repeated access to the same working sets.

### 2. Monitor partition-level metrics, not just container-level

Container-wide averages (total throughput consumed, average latency) hide partition-level problems. The throttling that takes down your busiest workload might not even register as a blip on the container dashboard. If your database supports per-partition metrics or throttle diagnostics, set up alerts on those.

### 3. Design for 10x before you need it

Ask yourself: if one entity, one user, one workflow produces 10x or 100x the traffic it does today, does the partition key still distribute well? If the answer is "probably not," you need more cardinality or a composite key — and it's far cheaper to add that now than to migrate later.

### 4. Plan for the key being permanent

Partition keys are often immutable after creation. In Cosmos DB, you can't change a container's partition key path — you create a new container and migrate. In DynamoDB, changing the primary key means a new table. In Cassandra, changing the partition key means a new table with data migration.

The cleanest partition key migration is the one you never have to do. The second-best is the one you've planned for before the first incident forces your hand. Think about what the key should look like at scale, not just at launch.

### 5. Partition keys are workload design, not just schema design

This is the central lesson. Choosing a partition key is not a one-time schema decision. It's a workload design decision that determines how your system behaves under real traffic patterns.

Your data model tells you what your entities look like. Your partition key should tell you how your system *gets used under stress*.

### 6. Optimize for sleep

This sounds unserious. It isn't.

A design that looks slightly more complex on a whiteboard can be much simpler operationally. If it prevents hot partitions, noisy-neighbor incidents, and emergency migrations at 3 AM, that complexity pays for itself every night your team sleeps through.

---

## Quick Reference: Partition Key Cheat Sheet

| Scenario | Recommended approach |
|---|---|
| High-write, skewed traffic (some entities much busier) | Composite/hierarchical key: scope prefix + sub-key for cardinality |
| Moderate, evenly distributed writes | Simple entity-based key with good natural cardinality |
| Time-series / append-heavy workload | Composite key: entity + time bucket (not raw timestamp) |
| Read-heavy, rarely updated | Optimize key for query patterns; write distribution is less critical |
| Multi-tenant SaaS | Include tenant scope in the key to enable isolation and efficient tenant-scoped queries |
| Global, multi-region deployment | Consider how partition key interacts with replication topology and consistency model |

---

## Wrapping Up

Partition keys are one of those decisions that feel small at design time and enormous at incident time. They're easy to get right when you think about workload shape, and easy to get wrong when you think only about data shape.

The lesson here isn't that flat partition keys are always bad. It's that **partition keys should reflect how your system gets used under stress, not just how your entities relate on paper.**

When some parts of your workload are much heavier than others — and they usually are — the key has to acknowledge that reality. If it doesn't, production will eventually teach you. And that lesson tends to arrive at 3 AM.

Design for skew. Test with realistic load. Monitor at the partition level. And if you get the key wrong, know that you're not alone — this is one of the most common growing pains in distributed database design.

The goal isn't a partition key that's clever. It's a partition key that lets everyone sleep.

---
