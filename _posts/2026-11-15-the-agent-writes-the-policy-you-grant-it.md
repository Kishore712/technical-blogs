---
layout: post
title: "The Agent Writes the Policy, You Grant It - Building an MCP Adapter for Muse"
date: 2026-11-15
reading_time: "20 min read"
tags: [AI Agents, MCP, Security, System Design, Architecture]
excerpt: "How to let an AI agent draft its own access to your tools without letting it grant that access, explained with interactive figures and real runs against GitHub."
---

{% assign fig = '/B-ai-agents/B1-Muse-MCP-Adapter/interactive' | relative_url %}
<link rel="stylesheet" href="{{ fig }}/widgets.css">

## The Scenario

Here's the kind of thing you'd want to be able to say to an AI agent:

> Read the issues and pull requests in my repo. Maybe comment on one later. Never merge, never delete, never touch my other repositories. And only for this afternoon.

The agent is Muse, a personal AI agent, and the repo is a private service repository. The job is the dull part of maintaining it: reading the issue queue, spotting duplicates, replying "we are looking into it".

There's an MCP server for GitHub, and Muse can add an MCP server as a connector. So getting access isn't the hard part. Deciding **how much** access is.

<div class="mma" data-widget="hero"><p class="mma-fallback">Interactive figure: calls from Muse flow through the adapter. Approved ones reach the servers, the rest are refused at the adapter.</p></div>

This post is about the [Muse MCP Adapter](https://github.com/sept-usc/muse-mcp-adapter), an open-source gateway built at [SEPT Lab](https://septlab.com/) (Security, Privacy, and Trust) at the University of Southern California for exactly that problem. It sits between Muse and your MCP servers, and it's built around one idea: **the agent writes the policy, but only you can grant it.** When this post says "we", it means the team at SEPT Lab.

The figures are interactive. Click around: they run small simulations of the adapter's real rules. Everything in the "real runs" sections comes from logged sessions with real Muse against a real, private GitHub repository.

---

## Four Rules in One Sentence

Look at that request again. Tap a rule type to see what each part asks of the system.

<div class="mma" data-widget="sentence"><p class="mma-fallback">"Read the issues and pull requests in my repo. Maybe comment on one later. Never merge, never delete, never touch my other repositories. And only for this afternoon."</p></div>

That one sentence carries four different kinds of rule: **which operations**, **which values**, **which direction** (more later, but only if I say so) and **how long**.

A connector built for one server exposes whatever that connector offers, and holds none of these four for you. If the GitHub server adds a tool next week, the agent sees it next week, whether anyone reviewed it or not.

And nobody wants to write a policy file to get there. You want to say the sentence and be done. Which leaves an awkward question: how do you let the agent turn a sentence into a policy, when the agent is the very thing the policy is for?

---

## A Quick Primer: MCP and Muse Connectors

**MCP**, the Model Context Protocol, is how services publish capabilities to AI agents. A server offers four kinds of thing:

- **Tools**: actions, possibly with side effects.
- **Resources**: data addressed by a URI.
- **Resource templates**: resources with parameters.
- **Prompts**: named message templates.

Clients discover these at run time, and servers can change them whenever they like. The adapter targets MCP `2026-07-28` over remote Streamable HTTP.

**Muse Custom Connectors** are how Muse adds a service. Muse reads an OpenAPI description, shows you a Connect card, and keeps the token in its own secure field. It classifies operations as Read, Write or Sensitive Write, keeps credentials away from the model, asks you before consequential actions, and keeps an activity history.

Those safeguards are good, and the adapter replaces none of them. The two worlds just don't line up:

| Area | Muse connector | MCP server | What the adapter does |
|---|---|---|---|
| Contract | Fixed service operations | Dynamic capabilities | A stable, versioned front |
| Discovery | Defined at setup | Listed at run time | Snapshot, review, publish |
| Permissions | Read / Write / Sensitive Write | Advisory annotations | An owner policy, independent of the server |
| Auth | Connector credential | OAuth or tokens per server | Two separate authentication boundaries |
| Change | Connector lifecycle | Tools can change any time | Nothing reaches Muse until published |

So the adapter adds a layer **you run and control**, between Muse and each MCP server, where the four rules in that sentence can live and be enforced.

---

## The Rule Everything Else Follows

If you only remember one sentence from this post, make it this one:

> The agent may draft any policy, but only the owner can make access wider, and only for exactly what the owner saw.

It breaks down into four rules:

1. **Nothing is exposed until the owner publishes it.** Discovery, drift checks and proposals never change what Muse can call.
2. **Widening is a human act, tied to what the human saw.** It takes the owner password on the adapter's own page, and the approval is bound to a digest of that page.
3. **Narrowing is free.** Switching an operation off, adding a limit, ending access sooner or disconnecting can only reduce access, so the agent may do it alone, at once.
4. **The live contract can't be changed.** What Muse may call is a compiled, versioned catalog. A server can't change it, and neither can a request.

The rest of the post is about how every layer keeps those four true.

---

## The Shape of the Thing

The adapter is one gateway process, built as a modular monolith: a control plane, a data plane and an optional setup surface, with one local store and an owner-held secret store. Tap any box, or trace a request through it.

<div class="mma" data-widget="arch"><p class="mma-fallback">Interactive figure: the adapter's components. Muse and the owner on the left, the setup connector, review pages, control plane, catalog, data plane, credentials and audit inside, MCP servers on the right.</p></div>

There are three contracts, one at each edge. **Toward Muse**: stable REST operations described in OpenAPI. **Inside**: a provider-neutral model of servers, primitives, policies, catalogs, connections, operations, drift and audit. **Toward servers**: MCP, exactly as the spec defines it.

The unit of isolation is a **connection**: one link between Muse and exactly one MCP server, with its own connector URL, token, policy, catalog and credential. Connect a second server and you get a second connection. It's a record inside the one process, not a separate program. Queues, workers and isolated runners are left out on purpose, until a real workload needs them.

---

## From a Live Server to a Frozen Contract

The control plane's job is to turn "whatever the server offers right now" into "exactly what the owner approved". Step through it and watch GitHub's tools change state.

<div class="mma" data-widget="pipeline"><p class="mma-fallback">Interactive figure: register, discover, snapshot, policy, compile, publish.</p></div>

The part I care most about is the compile step. Every published operation turns into a fixed mapping:

```text
connector ID · catalog version · public operation ID
MCP server registration ID · primitive type and name
approved schema digest · policy classification
required authorization profile and scopes · result and lifecycle policy
```

There's no generic `invoke(server, tool, arguments)` operation anywhere. Muse can call `add_issue_comment` on one connection because that exact mapping was compiled and published, and for no other reason.

A few more details that matter:

- **Annotations are evidence, not permission.** A tool without `readOnlyHint: true` can't be classified as a read without an explicit review flag. Tools that look destructive (a `destructiveHint`, or a word like delete or merge in the name) get drafted as sensitive writes.
- **Descriptions are pinned when you publish**, so a server can't later change what Muse is told about a tool.
- **The four primitives stay separate.** A resource is never quietly turned into a tool, and *fetching a prompt never authorizes the tool calls it mentions*.
- **Drift is visible.** When a server changes, `drift` reports each difference by kind and severity, and nothing reaches Muse until you publish a new version. `rollback` gets you back to the previous one.

---

## Letting the Agent Draft Without Letting It Grant

All of that works from a terminal. Setup by chat moves it into the conversation, and this is where the rule from earlier gets tested hardest.

You add exactly **one** connector to Muse by hand: the adapter's setup connector. Every server after that is a conversation. The setup connector has 13 operations, and their names describe everything it can do:

| Group | Operations |
|---|---|
| Look up | `how_setup_works` `find_server` `list_connections` `explain_connection` `get_service_details` `get_proposal_status` |
| Propose | `propose_connection` `revise_proposal` `propose_change` |
| Narrow | `turn_off_operations` `limit_arguments` `expire_access` `remove_connection` |
| Not there at all | anything that publishes, activates, links, stores a secret or widens |

An agent steered by a hostile web page can call all 13 and still not gain a single new permission. Here's the full flow. Step through it: each step says which attack it closes.

<div class="mma" data-widget="sequence"><p class="mma-fallback">Interactive figure: the 14 steps of connecting GitHub by chat, between you, Muse, the setup connector, the review page and the GitHub MCP server.</p></div>

Three things keep a misled agent from widening anything.

**The compiler is deterministic.** It never reads the service's descriptions or your words. It checks the exact names Muse sent against the frozen snapshot, reports anything it can't match, and turns the rest into policy. The language model is used where it's good, turning "issues and PRs, nothing that deletes" into a selection, and kept well away from the place where a mistake would widen access.

**The service's own text never reaches Muse before you approve.** Muse gets names and labels the adapter worked out. The service's descriptions, which a hostile server could stuff with instructions, only appear on your page, escaped and marked as the service's words. Invisible and direction-changing characters are stripped from anything the agent sends, so what you read is what gets recorded.

**Approval is a typed secret, tied to what you saw.** Unlocking a review page gives you 30 minutes to read, and reading approves nothing. **Approve** asks for the password again, every time. The approval is bound to a digest of the page, so if anything changed since it was rendered (a new revision from Muse, say), it's refused. Five wrong passwords lock the link. The page also shows an **alignment line**: how many things you asked for, how many would become available, and how many nobody asked for.

---

## Narrow Now, Widen Later

This is the rule the whole design rests on, so try it yourself. You're on both sides here: press Muse's buttons on the left, and play the owner on the right.

<div class="mma" data-widget="asymmetry"><p class="mma-fallback">Interactive figure: Muse narrows access instantly, while each widening becomes a proposal that waits for the owner password.</p></div>

Narrowing applies at once and bumps the catalog version. Widening only ever creates a proposal. And "approve my own proposal" doesn't exist as an operation, so it's a plain `404`.

The real adapter enforces this where access goes live, not just in the setup handlers. The component that activates a catalog refuses to activate a wider one on the agent's behalf, whoever asks. Changes to one connection are serialized, and before a change goes live the adapter checks that the live catalog is still the one the change was built from. That second check exists because testing found a race, which I'll come back to.

There's also no per-call approval. A denied operation stays denied until the policy is widened through this process, and Muse's own confirmation of writes still applies on top.

---

## Seven Checks on Every Call

Toward Muse, every connection has the same four routes, and they never change:

| Request | Purpose |
|---|---|
| `GET /c/<slug>/openapi.json` | The description Muse reads; lists only approved operations |
| `POST /c/<slug>/operations/<name>` | Calls one approved tool, resource or prompt |
| `GET /c/<slug>/executions/<id>` | Status, progress and log messages of an earlier call |
| `POST /c/<slug>/executions/<id>/resume` | Answers a question the server asked mid-call |

What changes is the generated description, which is built from the active catalog on every request. Pick a request and send it through the checks:

<div class="mma" data-widget="gates"><p class="mma-fallback">Interactive figure: seven checks on every call, and where each example request stops.</p></div>

Anything that fails steps 1 to 3 is refused before the server is contacted. Three of these checks look simple and aren't.

**Argument limits.** A tool can be held to a list of values, or to a short pattern that the whole value must match. Leaving the argument out is refused too, otherwise omission would be a way around the limit. A list argument passes only if every item is allowed. Muse is told about the limit, and the argument becomes required. An operation with a limit only accepts the arguments its schema declares, so a made-up alias can't say the same thing. And a pattern whose repeated group itself repeats, like `(a+)+$`, is refused the moment it's proposed.

**Expiry.** Every call checks the adapter's own clock, so nothing has to run for access to end, and an unreadable end time counts as already ended. A time window from chat starts when you press Approve, not when Muse asked, and is capped at 30 days.

**Results are untrusted.** They're checked against the published schema, MIME type and size before going back to Muse. Resource URIs can't use `file:` or `data:`. Images, audio, structured output, progress and mid-call questions (`409 INPUT_REQUIRED`, then `resume`) are all carried across, and each feature is tested against a direct MCP client.

---

## Writes That Run Once

Agents retry. Networks drop responses. A write that runs twice opens two pull requests. So in the adapter a write isn't a function call, it's a small state machine, and it's recorded **before** the downstream call starts. Go ahead and break it:

<div class="mma" data-widget="writes"><p class="mma-fallback">Interactive figure: PENDING, RUNNING, COMPLETED, FAILED, UNKNOWN and reconcile.</p></div>

The rules, in short:

- A repeated write is **replayed, not re-run**. Muse's `Idempotency-Key` is honoured, and without one an identical write counts as a retry while the first one runs or for 30 seconds after.
- A failure **before** anything was sent is safe to repeat and says so: `503` with `Retry-After`.
- If the adapter can't tell whether a write happened, it becomes `UNKNOWN`, and retries get `409 UNKNOWN_OUTCOME` until you check the other system and run `reconcile`.
- Every error carries `retryable` and `nextStep`. That small contract matters more for an agent than for a person, because it's what stops a well-meaning retry loop from doing harm.

---

## Where It Runs

```text
Muse ──(connector token)──▶ Adapter ──(this connection's own credential)──▶ MCP server
```

There are two separate authentication boundaries. Muse holds one revocable token per connector, and it only works on that connector. Each connection has its own downstream credential: none, a token in a root-only file, or your OAuth sign-in with the tokens encrypted at rest. In chat setup you type the service token on the adapter's page, so it never passes through the chat.

The deployment tool, `muse-vm`, puts one adapter on one machine you control: a new Google Cloud VM, an existing Linux box over SSH, or the machine it runs on.

- **One way in: Tailscale Funnel.** Muse needs a public HTTPS address with a real name. Funnel gives one while the machine has no public IP and accepts no inbound connection.
- **Built on the target.** From the code you installed, with hash-locked dependencies and base images pinned by digest. There's no registry of ours in the middle.
- **An egress guard owns the network.** The cloud metadata server and private ranges are blocked, so even a compromised adapter can't borrow the machine's cloud identity.
- **Unprivileged and read-only.** No capabilities, and setup ends with a self-check from outside and inside the machine. It's safe to run again if it stops half way.

There's no shared service in the middle. Each deployment serves one owner.

---

## The Paper Trail

There are two logs, both on your machine. The **runtime audit** records every call along with the catalog version that answered it. The **administrative audit** records every change, and each row carries a hash of the row before it. Below are the real events from one widening in our live run. Tamper with them and see what happens.

<div class="mma" data-widget="chain"><p class="mma-fallback">Interactive figure: a hash-chained audit log that breaks visibly when a row is edited or deleted.</p></div>

Together the two logs give you a walk that's usually impossible with agent tooling: `explain-call` takes a call to its catalog version, the proposal behind it, your words as Muse relayed them, and your approval. If you note the head hash somewhere else, `audit-verify --head HASH` also catches rows cut off the end.

One limit worth knowing: a chain like this catches edits and removals, not an attacker with root who rebuilds the whole thing. That attacker already holds the adapter's keys anyway.

---

## One Afternoon, For Real

On 2026-11-02 and 03 we ran the whole flow with real Muse, in a fresh chat, against a private test repository, through a deployed adapter. The GitHub token behind the adapter **could write** to that repository, so for writes the adapter was the only thing in the way. The prompts were plain and never told Muse which connector to use.

That last part matters. An earlier round did name the connector in the prompts, and we threw those results out, because that tests our instructions, not the adapter.

Here's the afternoon, in the order it happened:

<div class="mma" data-widget="replay"><p class="mma-fallback">Interactive figure: ten beats from the live runs, each with the chat, what the adapter recorded, and what GitHub showed.</p></div>

Alongside the Muse runs, we sent 188 hostile HTTP cases straight at the deployed adapter: operation names that must not exist for the agent (`approve_proposal`, `publish`, `set_policy` and more), tokens used across connections, the paths scanners try, malformed and oversized bodies, regex denial-of-service patterns, private and encoded addresses in proposals, and a non-owner browser guessing owner passwords. The guesses got `403` four times, then `429 Locked`, and that link stayed locked for every client.

On the hostile issue, two things are true, and both belong here. Muse's own safeguards held, and they deserve the credit. And if they hadn't, the adapter would still have stopped every instruction in that text: no merge or delete tools were published, the agent can't loosen a limit, and a widening only makes a proposal that waits for the owner's password.

---

## What We Got Wrong

Testing against the real thing found real bugs. The first one is easiest to show. Here's an argument limit that should only allow pages under `/guides/azure/`:

<div class="mma" data-widget="traversal"><p class="mma-fallback">Interactive figure: a URL limit checked before and after the path traversal fix.</p></div>

**A path traversal bypass in argument limits.** The first version matched the pattern against the value as written. But the service resolves the path, and the pattern only saw the text. So `../`, its encoded forms and a backslash form all got through, and a real documentation server returned the pages the limit was meant to block. The fix checks every reading of the value, and also stops forwarding undeclared arguments next to a limited one. After the fix, all 188 cases were re-run against the live deployment, and every traversal form got a `400`.

**A lost update when narrowing happened concurrently.** Three `limit_arguments` calls at the same moment all answered "The limits are in place". Afterwards only two of the three existed. Each handler read the catalog, built a narrower one and published it, and the last publish won. This one failed open: your restriction and the agent's report both disagreed with the live policy. If this sounds familiar, it's the classic lost update I wrote about in [Concurrency in Databases]({{ '/blog/concurrency-in-databases/' | relative_url }}). The fix is the same idea too: one lock around every catalog rewrite, plus a check that the live catalog is still the one the change was built from. Re-tested live, every concurrent narrowing now sticks, and a loosening attempt in the same burst gets `409`.

**"Read only" isn't a scope.** The request said "this repo", but only `readOnly: true` reached the structured proposal. So the read-only connection could also read other repositories and search all of GitHub. The page now warns in amber when "read only" would expose more than five items. Grouping by area and an explicit scope field are still open.

**Limits reached tools, not prompts.** Two GitHub prompts that take `owner` and `repo` still accepted another repository. Those are now listed as "not enforced" on the review page, and `limit_arguments` returns them so Muse can offer to switch them off.

**Smaller ones.** Blocked probes left no audit row (now they do). A queue of five junk proposals could block a real one for a day (`proposal-decline --all` now clears it without a browser). A non-owner's failed password guesses were recorded as if the owner made them (now they're `chat-setup:unverified`, followed by `setup.unlock.locked`).

None of these turned up by reading the code. They turned up by running a real agent against a real service with write access, and by attacking the deployed adapter from the outside.

---

## Things We Decided Not to Build

| Option | Why it's tempting | Why we didn't |
|---|---|---|
| Connect each MCP server to Muse directly | Nothing extra to run | Repeats protocol, auth, drift and policy work per server, and there's nowhere to say "this repo, these operations, until 5 pm". Still the right call for one simple, stable server |
| One generic `invoke(server, tool, args)` proxy | A tiny surface | The contract becomes "anything", so nothing can be reviewed, classified or pinned |
| Let the agent write *and* apply the policy | The smoothest experience | The agent reads untrusted text and can be steered. Drafting is safe to hand over. Granting isn't |
| The owner writes the policy file by hand | No model involved | Nobody wants to tick 40 tool names, so policies end up too broad. Still supported from the terminal |
| Ask the owner on every call | Maximum control | Approval fatigue, and the HTTP interface between Muse and a connector can't carry approval evidence today |
| A hosted, shared adapter | Nothing for the owner to run | The owner loses custody of credentials, policy and audit |
| A public IP with our own TLS | Familiar | An open inbound port. Funnel gives a named HTTPS address with nothing listening |

The cost we accepted is one more service to run. It pays off once you have several servers behind one reviewed boundary, access you want to keep small, or writes that must never run twice.

---

## What It Doesn't Do Yet

- Policy works per operation and per argument value. It can't yet decide by who is asking, or by how many records a call touches.
- Limits reach tools, not prompts or resource templates. Those are listed as not enforced.
- Drift tells you what changed, not whether the change is safe.
- An unknown write is settled by hand, with no automatic read-after-write check.
- The owner password is a typed secret, so a look-alike page could ask for it. Every review page shows the adapter's own address at the top. Passkeys would fix this and aren't built yet.
- One owner per deployment: no teams, roles or single sign-on.
- Remote servers only. No local `stdio` servers or MCP Apps rendering, and it's only been tested with Muse.
- It governs what passes through the adapter, not Muse's other tools, like its own browser.

---

## Quick Reference

| Idea | What it means in practice |
|---|---|
| Split drafting from granting | The agent proposes; a deterministic compiler and the owner's password decide |
| Freeze the truth first | Snapshot what a service offers, with a digest, before anyone reasons about it |
| Narrowing is free | Off, limit, end sooner, disconnect: instant, no approval |
| Widening is a proposal | One operation at a time, password every time, bound to the page digest |
| The contract is compiled | One fixed mapping per operation, no generic invoke |
| Writes are a state machine | Replayed, never re-run; `UNKNOWN` blocks blind retries |
| Everything is on the record | Hash-chained changes, and every call tied to its catalog version |
| Test with the real thing | Real agent, real service, real write access, attacked from outside |

---

## Wrapping Up

When you give an agent tools, it's tempting to treat access as a switch: on or off. In practice it's more like a contract that keeps changing. That one sentence had four rules in it, and the agent was the best placed to write them down, and the worst placed to sign them.

So the adapter lets the agent do the writing. It freezes what the service really offers, checks every name the agent drafts against that, and then hands the pen to the owner for the one step that matters. Narrowing stays free, so the agent can always make things safer on its own. Widening always comes back to a person.

Let the agent write the policy. Keep the signature for yourself.

*The Muse MCP Adapter is open source (MIT) and developed at [SEPT Lab](https://septlab.com/), USC, as part of the lab's work on AI agent security. The code, the design notes and the full documentation are on [GitHub](https://github.com/sept-usc/muse-mcp-adapter).*

<script src="{{ fig }}/widgets.js" defer></script>
