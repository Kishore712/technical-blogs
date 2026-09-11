# Concurrency in Databases - What It Is, Why It Breaks Things, and How to Handle It

*Reading time: ~12 min*

---

## The Scenario

Two API requests hit your service at the same time. Both read the same record. Both modify it. Both write back.

Whose changes survive?

If the system doesn't handle this, one write silently overwrites the other. No error, No warning, Just wrong data. This is the concurrency problem, and it shows up anywhere multiple processes can touch the same data at the same time.

This post covers what concurrency is, the specific problems it creates, and the strategies that exist to handle it.

---

## What Is Concurrency?

Concurrency means multiple operations are in progress at the same time, potentially accessing the same data.

![Sequential vs concurrent access]({{ '/A-database/B2-Concurrency/images/01_what_is_concurrency.png' | relative_url }})

In sequential access, one operation finishes before the next starts. Safe, but slow. In concurrent access, operations overlap — fast, but now they can interfere with each other.

Three conditions must all be true for a concurrency problem to occur:

1. **Shared state** — multiple operations access the same data
2. **At least one writer** — at least one is modifying
3. **Overlapping timing** — they happen in the same window

Remove any one of these three, and the problem disappears.

---

## The Problems Concurrency Creates

### Lost Update

Two operations read the same value, both modify it, both write back. The second write overwrites the first. One change silently vanishes.

![The lost update problem]({{ '/A-database/B2-Concurrency/images/02_lost_update.png' | relative_url }})

This is the most common and most dangerous concurrency bug — dangerous because it is completely silent.

---

### Dirty Read

An operation reads data that another operation has written but not yet committed. If that other operation rolls back, the reader acted on data that was never committed.

![Dirty read]({{ '/A-database/B2-Concurrency/images/03_dirty_read.png' | relative_url }})

**Example:** An admin starts a transaction to change a project from "private" to "public." The transaction writes the new visibility but hasn't committed yet — it's still updating ACL entries. A search indexer reads the project mid-transaction, sees "public," and indexes it for public search. The admin's transaction then rolls back because the ACL update failed. A private project now appears in public search results — the indexer read uncommitted data that never became real.

---

### Non-Repeatable Read

An operation reads the same data twice within one transaction and gets different results because another operation modified it in between.

![Non-repeatable read]({{ '/A-database/B2-Concurrency/images/04_non_repeatable_read.png' | relative_url }})

---

### Write Skew

Two operations each read the same data, make independent decisions that are individually valid, and write to different records. Together, they violate a constraint that neither broke alone.

![Write skew]({{ '/A-database/B2-Concurrency/images/05_write_skew.png' | relative_url }})

Write skew is the hardest to detect because each operation, looked at in isolation, did nothing wrong.

---

## Concurrency Control Strategies

There are two fundamental approaches. Each makes a different bet about how likely conflicts are.

### Pessimistic vs. Optimistic

![Pessimistic vs optimistic concurrency]({{ '/A-database/B2-Concurrency/images/06_concurrency_type.png' | relative_url }})

**Pessimistic (Locking)** assumes conflicts are likely. Lock the data before touching it. Nobody else can access it until you are done. Safe, but others wait.

**Optimistic (Versioning)** assumes conflicts are rare. Read freely, write freely, but check at write time whether anyone else changed the data since you read it. If they did, reject your write. Fast, but conflicts mean wasted work.

---

### How Optimistic Concurrency Works

This is what ETags, conditional writes, and Compare-and-Swap (CAS) operations implement. The database gives you a version marker on read, and you pass it back on write as a condition.

![Optimistic concurrency flow]({{ '/A-database/B2-Concurrency/images/07_optimistic_concurrency.png' | relative_url }})

If the version still matches, your write goes through. If someone else got there first, you get a conflict error and have to re-read and retry.

Cosmos DB, DynamoDB, MongoDB, and CouchDB all support this pattern.

---

### Multi-Version Concurrency Control (MVCC)

Instead of locking or rejecting, MVCC keeps multiple versions of each record. Each operation sees a consistent snapshot from when it started, regardless of what others are doing.

![MVCC explained]({{ '/A-database/B2-Concurrency/images/08_mvcc.png' | relative_url }})

PostgreSQL, MySQL (InnoDB), Oracle, and CockroachDB use MVCC internally. It is the mechanism behind isolation levels like `SNAPSHOT` and `REPEATABLE READ`.

Writers do not block readers. Readers do not block writers. Conflicts are resolved at commit time.

---

### Event Sourcing / Append-Only

Instead of fighting over mutable state, append a new event describing what changed. The current state is derived by replaying the log.

Writers never conflict because they are appending to a log, not overwriting shared state.

**Best for:** many independent writers contributing facts (chat messages, activity feeds, audit logs), or chronic contention on hot records where versioning creates retry storms.

**Trade-off:** reading current state requires replaying or materializing the log.

---

## When Optimistic Concurrency Breaks Down

For most systems, optimistic concurrency is the right default. But it has specific failure modes.

### Multiple writers with different intents

When a single record attracts writes from many sources — user actions, background jobs, cleanup processes, API integrations — the conflict rate climbs. Each conflict triggers a re-read and retry. Retries create more contention than the original workload.

![Multiple writers contention]({{ '/A-database/B2-Concurrency/images/09_multiple_writers.png' | relative_url }})

### Not every failure deserves a retry

When a write fails, the instinct is to retry. But retries are not always the right response. Classifying failures before deciding what to do avoids wasted work and retry storms.

![Retry classification]({{ '/A-database/B2-Concurrency/images/10_retry_classification.png' | relative_url }})

### Self-inflicted contention

If your system fans out too many parallel writes to the same data, you are not just experiencing contention, you are causing it. Capping parallelism intentionally often outperforms "fire everything at once."

---

## Practical Patterns

When basic version checks are not enough:

**Chunk and retry**: break large batches into smaller independent chunks. Retries are scoped to the failed chunk, not the entire batch.

**Reduce conflict surface**: smaller, targeted updates conflict less often than full document replacements. Touch only the fields you need.

**Cap concurrency**: set a maximum degree of parallelism for write operations. More concurrent writers does not always mean more throughput — past a point, it means more retries and worse tail latency.

**Tolerate asymmetry**: not every consistency edge needs synchronous enforcement. If a dangling reference does not break serving correctness and can be repaired later, defer it.

**Match your consistency level**: strong consistency guarantees global ordering but costs latency. Session consistency gives you read-your-writes within a session at lower cost. Eventual consistency is cheapest but means readers may see stale data. Pick what matches your actual requirement, not the strongest one available.

---

## Choosing a Strategy

![Concurrency decision framework]({{ '/A-database/B2-Concurrency/images/11_decision_framework.png' | relative_url }})

**Quick reference:**

| Situation | Strategy |
|---|---|
| Few writers, low conflict | Optimistic (ETags / CAS) |
| Many writers, high contention | Pessimistic (locking) |
| Independent facts from many sources | Event sourcing / append-only |
| Same fields, overlapping updates | Optimistic + retry patterns |
| Low-value data, freshness over accuracy | Last-writer-wins |
| Expensive or irreversible operations | Locking or serialization |

The goal is not to eliminate conflicts. It is to build a system that handles them gracefully, matching the strategy to the workload shape, not the other way around.

---

