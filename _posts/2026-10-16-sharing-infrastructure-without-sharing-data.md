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

Say you're building a SaaS app for teams. A customer signs up, gets a workspace, invites a few colleagues, and they start creating things: settings, templates, drafts, reports.

Fast forward a bit and you have thousands of these customers. Giving each one its own database would be expensive and painful to run, so they all live in one shared database container.

That puts you in an interesting spot. Your business wants this running on as few machines as possible. Every customer, though, expects to feel like they're the only one using the product.

![One container, many tenants]({{ '/A-database/B3-Multi-Tenancy/images/01_city_block.png' | relative_url }})

I find it easiest to picture the container as a city block. Each customer (a *tenant*, in multi-tenancy terms) is a building on that block. The buildings share roads, water and power. Inside each building there's a lobby everyone in that building can use, and apartments that only one person has the key to.

Sharing the roads is fine. Wandering into someone else's building is not. That's really all multi-tenancy is about.

---

## Why One Shared Container?

![The tenancy spectrum]({{ '/A-database/B3-Multi-Tenancy/images/02_tenancy_spectrum.png' | relative_url }})

A database per tenant is the safest setup, since tenants are physically apart. The catch is that every new customer means one more database to create, back up, monitor and upgrade, and with thousands of small customers that work never really stops.

A shared container flips that around. Onboarding a customer is just inserting a record, and everyone shares the same capacity. The trade-off is that your code is now the only thing keeping tenants apart. In practice, most teams start shared and later move a handful of very large or very sensitive customers onto their own database.

The rest of this post is about making the shared setup safe, and a lot of it leans on the partition key. The short version: put the tenant ID in the key, and "give me only my tenant's data" becomes the fast, natural query. If partition keys are new to you, I wrote about them in [The Partition Key That Broke Production]({{ pk_post }}#what-is-a-partition-key).

---

## The Tenant Comes From the Login

If you take one thing from this post, take this: don't trust a tenant ID the user sends you. Get it from their login token instead.

![Where the tenant ID comes from]({{ '/A-database/B3-Multi-Tenancy/images/04_tenant_from_login.png' | relative_url }})

At t1, someone logged in to tenant A edits the URL and asks for tenant B's reports. If your service believed the URL, it would happily go fetch them. Instead, at t2 the gateway notices the URL and the token disagree, and turns the request away.

A normal request (t3 onward) works differently. The gateway turns the token into a small *access context* object that says who's calling, and that object is what gets passed down to the database layer. Not a loose `tenant_id` string that anyone could have typed.

In Python, with FastAPI, it might look something like this:

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

From here on, every route gets an `AccessContext`, and nothing further down accepts a raw `tenant_id`.

---

## Three Kinds of Data Inside a Tenant

Keeping tenant A out of tenant B's data is only half the story. Inside a single tenant, people also need some privacy from each other.

![Three kinds of data inside a tenant]({{ '/A-database/B3-Multi-Tenancy/images/05_three_kinds_of_data.png' | relative_url }})

Most products end up with three kinds of data:

| Kind | Example | Who can see it |
|---|---|---|
| Shared | tenant settings, templates | everyone in the tenant |
| Private | personal drafts | the owner (admins can audit) |
| Bridge | a user's link to an outside service | only the people named on it |

Shared data comes with its own headache: lots of people can edit it. If an admin and a teammate update the same settings record at the same moment, one of those changes can quietly disappear. That's the [lost update]({{ cc_post }}#lost-update) problem from my concurrency post, and [optimistic concurrency]({{ cc_post }}#how-optimistic-concurrency-works) (ETags or version checks) is the usual fix.

---

## A Two-Level Key

You don't need a second database for private data. You just need a second level in the partition key.

![A two-level partition key]({{ '/A-database/B3-Multi-Tenancy/images/06_two_level_key.png' | relative_url }})

The key becomes `[tenant_id, owner_id]`. Shared records use a placeholder owner, `_tenant`. Private records use the ID of the person who owns them. Bridge records live in their owner's slice and carry a list of who's allowed to use them.

If that looks familiar, it's the same [hierarchical key]({{ pk_post }}#flat-key-vs-hierarchical-key) that fixed hot partitions in the partition key post. Back there, the second level was about spreading one big tenant's writes across more partitions. Here, that same level also gives every user their own private room. I like that one design choice pays off twice.

One thing carries over from that post, though: partition keys are really hard to change once you have data ([plan for the key being permanent]({{ pk_post }}#plan-for-the-key-being-permanent)). Settle on the second level early, before you're sitting on millions of records.

---

## One Copy, Two Views

Now say an end user and an admin both open the drafts page. They should see different things, but you don't want to store the drafts twice.

![One copy, two views]({{ '/A-database/B3-Multi-Tenancy/images/07_one_copy_two_views.png' | relative_url }})

When the end user asks (t1), their context turns into the key prefix `[A, u1]`, so the database only opens their small slice. When the admin asks (t2), the prefix is just `[A]`. The database reads everything in tenant A and never goes near tenant B.

All of the "who sees what" logic lives in one small function:

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

There's deliberately no `list_drafts(tenant_id)`. The only way in is with an access context.

---

## Bridges Are Where Leaks Happen

Some data has to cross the line on purpose. A common example: an admin sets up an integration for the whole tenant, and then each user connects their own account to it.

![Cross-scope data: the bridge leak]({{ '/A-database/B3-Multi-Tenancy/images/09_bridge_leak.png' | relative_url }})

The top half of the diagram shows how this goes wrong. To save a lookup, u1's login token gets cached right on the shared integration record (t1). Everyone in the tenant is allowed to read that record (t2), so when u2's job loads it, u2 quietly gets u1's token too (t3). No partition rule was broken here. The data model was the problem.

The bottom half is the safer version. The shared record only holds settings, like the endpoint and permissions, and no secrets at all. Each user's connection lives in their own slice and points to their secret rather than storing it. If u2 hasn't connected yet, the app just asks them to.

A few habits keep bridges from turning into leaks. Treat them as their own kind of data instead of a special case buried in some feature. Share as little as you can get away with. Keep track of who's allowed to use each one, and check that every time. And never put a secret on a record that lots of people can read.

---

## Enforce Below the API

Imagine someone refactoring an export job, and the line that filters by tenant gets deleted by accident.

![The missing filter]({{ '/A-database/B3-Multi-Tenancy/images/08_missing_filter.png' | relative_url }})

On the left, the job uses a generic query helper. With the filter gone, the query happily reads every tenant, and the export now includes other customers' data. Worse, the tests still pass, because tenant A's data is all there too.

On the right, the repository simply has no method that works without a context. The same mistake now throws an error instead of leaking anything.

Notice that the export job never went through the API at all. Plenty of code doesn't: background jobs, admin tools, event replays, the one-off script someone runs on a Friday afternoon.

![Check at every layer]({{ '/A-database/B3-Multi-Tenancy/images/10_check_every_layer.png' | relative_url }})

Each of those skips whatever checks live above where it comes in. So the checks that really matter belong in the layers every path passes through. The service layer decides whether this caller is allowed to use this scope at all, because a partition key only limits where a query can go, not who's allowed to send it. The repository builds the key from the context and refuses to run without one. And background jobs carry the access context they were created with, instead of running as some all-powerful system user.

---

## Test What Must Never Happen

Most tests check that the right person sees the right data. With multi-tenancy, the tests that actually save you are the ones checking that the wrong person sees nothing:

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

A small trick that makes these much more useful: seed at least two tenants with the same document IDs, say `draft-7` in both. If anything ever matches across tenants, you'll see it straight away.

---

## Quick Reference

A cheat sheet, if you want one:

| Idea | What it means in practice |
|---|---|
| Share machines, not visibility | One shared container, with who-sees-what designed on purpose |
| The login decides the tenant | Build an access context from the token |
| Two levels when users need privacy | A `[tenant, owner]` partition key |
| One copy, many views | The caller's context picks the key prefix |
| Make the safe path the only path | No database call without a context |
| Treat bridges as their own kind of data | Keep them small, tied to people, and free of secrets |
| Check where every path passes | In the service and repository, not just the API |
| Test the "no" cases | Two tenants, same IDs, assert nothing leaks |

---

## Wrapping Up

Multi-tenancy isn't really a choice between "shared" and "separate". It's a few simple layers on top of shared machines: a wall around each tenant, private rooms inside it, a few bridges you build carefully, and a check at every door.

There's also the question of tenants slowing each other down, which is a different problem and has more in common with the [hot partitions]({{ pk_post }}#the-problem-hot-partitions) story than with this one.

Get the visibility side right, though, and every customer gets to feel like they have the place to themselves, while you keep running one small, efficient fleet.

Share the machinery. Never the data.
