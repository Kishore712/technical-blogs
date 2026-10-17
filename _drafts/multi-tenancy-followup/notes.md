# Follow-up post notes: running a multi-tenant system

Sections cut from 'Sharing Infrastructure Without Sharing Data' (2026-10-16). Image paths refer to the diagrams moved into this folder.

## Noisy Neighbors

Everything so far stops tenants from **seeing** each other. They can still **slow each other down**.

![The noisy neighbor]({{ '/A-database/B3-Multi-Tenancy/images/11_noisy_neighbor.png' | relative_url }})

Tenant B starts a huge import (**t1**) and uses up the shared capacity (**t2**). Tenant A's simple read (**t3**) is throttled (**t4**). For tenant A, your product looks broken, and they did nothing wrong.

This is the multi-tenant version of the [hot partition]({{ pk_post }}#the-problem-hot-partitions) problem, and, as that post showed, [just adding capacity doesn't fix it]({{ pk_post }}#why-just-add-more-capacity-doesnt-fix-it). What helps:

- **Per-tenant limits**, so one customer can't use the whole pool.
- **A separate lane for big jobs** like imports and exports.
- **Moving heavy tenants** to their own capacity (the hybrid model).

When tenant A does get throttled, retry carefully. Not every error deserves a retry, and blind retries make the pile-up worse. See [not every failure deserves a retry]({{ cc_post }}#not-every-failure-deserves-a-retry).


---

## The Tenant Lifecycle

Customers join, leave, and sometimes delete data by mistake. Sharing a container changes how hard each of those is.

![Tenant lifecycle]({{ '/A-database/B3-Multi-Tenancy/images/12_tenant_lifecycle.png' | relative_url }})

- **Removing a tenant is easy:** delete everything under the prefix `[B]`. Do it slowly, in small batches, so the cleanup doesn't become a noisy neighbor itself. The chunking and capped-parallelism ideas from [practical patterns]({{ cc_post }}#practical-patterns) apply directly.
- **Restoring one tenant is hard:** most databases restore a whole container, not one tenant. So you restore everything to a side copy (**t1**), then copy only tenant A's prefix back (**t2**). Write this script and practice it before a customer needs it.

```python
import time

def offboard_tenant(store, tenant_id: str, batch_size: int = 100):
    """Delete a tenant in small batches so other tenants don't feel it."""
    while True:
        batch = store.query(prefix=(tenant_id,), limit=batch_size)
        if not batch:
            break
        for doc in batch:
            store.delete(doc["id"], key=doc["pk"])
        time.sleep(0.5)   # leave capacity for everyone else
```


---

## Partition keys in one picture (cut primer)

See 03_partition_key_basics.png.

## Decision checklist (cut diagram)

See 14_decision_checklist.png.


---

## Isolation test matrix (cut)

See 13_test_matrix.png.

## Test What Must Never Happen

Normal tests check that the right person sees the right data. In multi-tenancy, the tests that save you check that the **wrong** person sees **nothing**.

![The isolation test matrix]({{ '/A-database/B3-Multi-Tenancy/images/13_test_matrix.png' | relative_url }})

List your actors and your kinds of data, then test every cell, especially the `deny` and `error` ones. `pytest.mark.parametrize` keeps this short:

```python
import pytest

member_a = AccessContext("A", "u1", "member")
admin_a  = AccessContext("A", "admin1", "admin")

@pytest.mark.parametrize("ctx, owner, expected", [
    (member_a, "u1", "allow"),   # my own draft
    (member_a, "u2", "deny"),    # a teammate's draft
    (admin_a,  "u2", "allow"),   # admin audit
])
def test_draft_visibility(repo, ctx, owner, expected):
    seen = {d["owner"] for d in repo.list_drafts(ctx)}
    assert (owner in seen) == (expected == "allow")

def test_admin_never_sees_other_tenant(repo):
    drafts = repo.list_drafts(admin_a)
    assert all(d["pk"][0] == "A" for d in drafts)

def test_no_context_fails_loudly(repo):
    with pytest.raises(Exception):
        repo.list_drafts(None)
```

Two habits make these tests much stronger:

- **Seed at least two tenants with the same document IDs** (for example `draft-7` in both). Accidental cross-tenant matches show up right away.
- **Check where the query went,** not only what came back. An empty result can hide a query that went to the wrong place.

