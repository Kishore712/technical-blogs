---
layout: post
title: "Sharing Infrastructure Without Sharing Data - Multi-Tenancy in Document Databases"
date: 2026-10-16
reading_time: "8 min read"
tags: [Databases, Multi-Tenancy, SaaS, Security, System Design]
excerpt: "How to keep thousands of customers in one database without any of them seeing each other, explained with simple pictures and small Python examples."
---

{% assign pk_post = '/blog/the-partition-key-that-broke-production/' | relative_url %}
{% assign cc_post = '/blog/concurrency-in-databases/' | relative_url %}

## The Scenario

Imagine you run a SaaS app for teams. Each customer gets a workspace, invites colleagues, and creates data: settings, templates, drafts, reports.

You have thousands of customers. To keep costs down, they all live in **one database container**.

Now you have to keep two promises:

1. **To your business:** run on a small, efficient set of machines.
2. **To every customer:** act as if nobody else exists.

![One container, many tenants]({{ '/A-database/B3-Multi-Tenancy/images/01_city_block.png' | relative_url }})

Think of the container as a **city block**. Each customer (called a **tenant**) is a **building**. Buildings share roads, water and power. Inside each building there is a **lobby** that everyone in that building can use, and **apartments** that only one person can enter.

Sharing the roads is fine. Walking into someone else's building is not. That is the whole idea of multi-tenancy.

---

## Why One Shared Container?

![The tenancy spectrum]({{ '/A-database/B3-Multi-Tenancy/images/02_tenancy_spectrum.png' | relative_url }})

A database per tenant is the safest option, but every new customer becomes one more database to create, back up and upgrade. A shared container is cheap and simple to run, but now **your code** is the only thing keeping tenants apart. Most teams share by default and move a few very large or sensitive customers to their own database.

This post is about making the shared model safe. It leans on the **partition key**: put the tenant ID in the key, and "only my tenant's data" becomes the fast, natural query. If partition keys are new to you, start with [The Partition Key That Broke Production]({{ pk_post }}#what-is-a-partition-key).

---

## Rule 1: The Tenant Comes From the Login

This is the most important rule in the post: **never trust a tenant ID that the user sends you.** Take it from their login token instead.

![Where the tenant ID comes from]({{ '/A-database/B3-Multi-Tenancy/images/04_tenant_from_login.png' | relative_url }})

- At **t1**, someone logged in to tenant A asks for tenant B's reports by changing the URL.
- At **t2**, the gateway compares the URL with the token, sees they don't match, and refuses.
- From **t3** onward, a normal request turns the token into an **access context**: a small object that says who the caller is. That object, not a loose string, travels down to the database.

Here is the idea in Python (FastAPI style):

```python
from dataclasses import dataclass
from fastapi import Depends, HTTPException

@dataclass(frozen=True)
class AccessContext:
    tenant_id: str
    user_id: str
    role: str          # "member", "admin" or "service"

def get_access(tenant_id: str, claims=Depends(verify_token)) -> AccessContext:
    # The URL is only a hint. The token is the truth.
    if tenant_id != claims["tenant"]:
        raise HTTPException(status_code=403)
    return AccessContext(claims["tenant"], claims["sub"], claims["role"])
```

Every route receives an `AccessContext`. No function below this point accepts a plain `tenant_id` argument.

---

## Three Kinds of Data Inside a Tenant

Keeping tenant A away from tenant B is only half the job. Inside one tenant, people also need privacy from each other.

![Three kinds of data inside a tenant]({{ '/A-database/B3-Multi-Tenancy/images/05_three_kinds_of_data.png' | relative_url }})

| Kind | Example | Who can see it |
|---|---|---|
| **Shared** | tenant settings, templates | everyone in the tenant |
| **Private** | personal drafts | only the owner (admins can audit) |
| **Bridge** | a user's link to an outside service | only the people named on it |

Shared data has many writers. An admin and a teammate can edit the same settings record at once. That is the classic [lost update]({{ cc_post }}#lost-update) problem, so protect shared records with [optimistic concurrency]({{ cc_post }}#how-optimistic-concurrency-works) (ETags or version checks).

---

## A Two-Level Key

You don't need a second database for private data. You need a **second level in the partition key**.

![A two-level partition key]({{ '/A-database/B3-Multi-Tenancy/images/06_two_level_key.png' | relative_url }})

The key becomes `[tenant_id, owner_id]`:

- **Shared** records use a special owner value, `_tenant`.
- **Private** records use the owner's user ID.
- **Bridge** records sit in their owner's slice and list who may use them.

If this looks familiar, it is the same [hierarchical key]({{ pk_post }}#flat-key-vs-hierarchical-key) that fixed hot partitions in the partition key post. There, the second level spread one big tenant's writes across many partitions. Here, the same second level also gives every user a private room. One design solves both problems.

One warning carries over too: a partition key is very hard to change later ([plan for it being permanent]({{ pk_post }}#plan-for-the-key-being-permanent)). Decide on the second level before you have millions of records.

---

## One Copy, Two Views

An end user and an admin both ask, "list the drafts." They should get different answers from **the same records**, with no copies.

![One copy, two views]({{ '/A-database/B3-Multi-Tenancy/images/07_one_copy_two_views.png' | relative_url }})

- At **t1**, the end user's context becomes the key prefix `[A, u1]`. The database opens one small partition.
- At **t2**, the admin's context becomes the prefix `[A]`. The database reads all of tenant A, and never touches tenant B.

The only place that decides "who sees what" is one small function:

```python
class DraftRepository:
    def __init__(self, store):
        self.store = store

    def _prefix_for(self, ctx: AccessContext) -> tuple:
        if ctx.role == "member":
            return (ctx.tenant_id, ctx.user_id)   # [A, u1]
        if ctx.role == "admin":
            return (ctx.tenant_id,)               # [A]
        raise PermissionError("role cannot read drafts")

    def list_drafts(self, ctx: AccessContext) -> list[dict]:
        prefix = self._prefix_for(ctx)
        return self.store.query(prefix=prefix, filter={"type": "draft"})
```

Notice what is missing: there is no `list_drafts(tenant_id)`. The only way in is with an access context.

---

## Bridges Are Where Leaks Happen

Some data has to cross the line on purpose. A common case: an admin sets up an integration for the whole tenant, and each user connects their own account to it.

![Cross-scope data: the bridge leak]({{ '/A-database/B3-Multi-Tenancy/images/09_bridge_leak.png' | relative_url }})

**Top (wrong):** to save a lookup, u1's login token is cached on the shared integration record (**t1**). Every member is allowed to read that record (**t2**), so u2's job quietly gets u1's token (**t3**). No partition rule was broken. The data model was.

**Bottom (right):** the shared record holds only settings: endpoint, permissions, no secrets. Each user's connection lives in their own slice and points to the secret instead of storing it. When u2 has no connection, the app asks u2 to connect.

Simple rules for bridge data:

- **Name it.** Treat bridges as their own kind of data, not a special case hidden in feature code.
- **Share the smallest useful fact.** Settings, never another person's state.
- **Store who may use it,** and check it every time.
- **Never put a secret on a record many people can read.**

---

## Enforce Below the API

Picture a routine refactor of an export job. One line, the tenant filter, is accidentally removed.

![The missing filter]({{ '/A-database/B3-Multi-Tenancy/images/08_missing_filter.png' | relative_url }})

**Left:** the code uses a generic query helper. Without the filter, the query reads every tenant, and the export now contains other customers' data. Tests still pass, because tenant A's data is all there too.

**Right:** the repository has **no method that works without a context**. The same mistake fails with an error instead of leaking data.

That export job never went through the API, and many callers don't: background jobs, admin tools, event replays and one-off scripts all enter **below** it.

![Check at every layer]({{ '/A-database/B3-Multi-Tenancy/images/10_check_every_layer.png' | relative_url }})

Each entry point skips the checks above it, so the important checks must live in the layers **every** path goes through:

- **Service:** "Is this person allowed to use this scope at all?" A partition key limits where a query can go; it does not decide whether the caller is allowed to go there.
- **Repository:** build the key from the context, and refuse if there is no context. Any helper that can query without a tenant is an incident waiting for the next refactor.
- **Background jobs:** carry the access context they were created with, instead of running as an all-powerful system user.

---

## Test What Must Never Happen

Normal tests check that the right person sees the right data. In multi-tenancy, the tests that save you check that the **wrong** person sees **nothing**:

```python
import pytest

def test_member_cannot_see_teammates_drafts(repo):
    drafts = repo.list_drafts(AccessContext("A", "u1", "member"))
    assert all(d["owner"] == "u1" for d in drafts)

def test_admin_never_sees_other_tenant(repo):
    drafts = repo.list_drafts(AccessContext("A", "admin1", "admin"))
    assert all(d["pk"][0] == "A" for d in drafts)

def test_no_context_fails_loudly(repo):
    with pytest.raises(Exception):
        repo.list_drafts(None)
```

One habit makes these tests much stronger: **seed at least two tenants with the same document IDs** (for example `draft-7` in both). Any accidental cross-tenant match shows up right away.

---

## Quick Reference

The whole post in one table:

| Principle | In practice |
|---|---|
| Share machines, not visibility | Use a shared container, design who-sees-what on purpose |
| The login decides the tenant | Build an access context from the token |
| Two levels when users need privacy | `[tenant, owner]` partition key |
| One copy, many views | The caller's context picks the key prefix |
| Make the safe path the only path | No database call without a context |
| Treat bridges as their own kind of data | Small, bound to people, no secrets |
| Check where every path passes | Service and repository, not just the API |
| Test the "no" cases | Two tenants, same IDs, assert nothing leaks |

---

## Wrapping Up

Multi-tenancy is not a choice between "shared" and "separate". It is a few simple layers on top of shared machines: a wall around each tenant, private rooms inside it, a few carefully built bridges, and checks at every door.

Keeping tenants from **slowing each other down** is a separate problem, closer to the [hot partitions]({{ pk_post }}#the-problem-hot-partitions) story than to this one.

Get the visibility layers right, and every customer feels like they have the place to themselves, while you run one small, efficient fleet.

Share the machinery. Never the data.
