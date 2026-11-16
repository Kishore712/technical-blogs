---
layout: post
title: "The Agent Writes the Policy, You Grant It - Introducing the Muse MCP Adapter"
date: 2026-11-15
reading_time: "18 min read"
tags: [AI Agents, MCP, Security, System Design, Architecture]
excerpt: "How AI agents connect to tools through MCP today, what can go wrong, and how the Muse MCP Adapter from SEPT Lab at USC lets an agent draft its own access while you keep the final say. With interactive figures and a real session against GitHub."
---

{% assign fig = '/B-ai-agents/B1-Muse-MCP-Adapter/interactive' | relative_url %}
<link rel="stylesheet" href="{{ fig }}/widgets.css">

## The Scenario {#scenario}

Here's the kind of thing you'd want to be able to say to an AI agent:

> Read the issues and pull requests in my repo. Maybe comment on one later. Never merge, never delete, never touch my other repositories. And only for this afternoon.

The agent is Muse, a personal AI agent, and the repo is a private service repository. The job is the dull part of maintaining it: reading the issue queue, spotting duplicates, replying "we are looking into it".

It sounds like one simple request, but look closer. Tap a rule type to see what each part asks of the system.

<div class="mma" data-widget="sentence"><p class="mma-fallback">"Read the issues and pull requests in my repo. Maybe comment on one later. Never merge, never delete, never touch my other repositories. And only for this afternoon."</p></div>

That one sentence carries four different kinds of rule: **which operations**, **which values**, **which direction** (more later, but only if I say so) and **how long**. Before getting to how they can be enforced, it helps to look at how an agent like Muse reaches a service like GitHub today.

The figures in this post are interactive. Click around: they run small simulations of the real systems.

---

## How It Works Today {#today}

Two pieces are involved.

**MCP**, the Model Context Protocol, is how services publish capabilities to AI agents. A GitHub, Linear or Notion MCP server offers four kinds of thing:

- **Tools**: actions, possibly with side effects, like `add_issue_comment`.
- **Resources**: data addressed by a URI.
- **Resource templates**: resources with parameters, like `issues://{project}/{id}`.
- **Prompts**: named message templates.

Clients discover these at run time, and a server can change them whenever it likes.

**Muse Custom Connectors** are how Muse adds a service. Muse reads an OpenAPI description of the service, shows you a Connect card, and keeps the token in its own secure field. Muse also brings real safeguards of its own: it classifies operations as Read, Write or Sensitive Write, keeps credentials away from the model, asks you before consequential actions, and keeps an activity history.

Put those together and the setup today is simple: you add each MCP server to Muse as its own Custom Connector. One server, one connector, a direct line from the agent to the service.

---

## What Can Go Wrong {#problems}

A direct line works, but it leaves gaps. Pick a problem to see where it happens, or play them all.

<div class="mma" data-widget="today"><p class="mma-fallback">Interactive figure: Muse connected directly to three MCP servers, and seven problems that can occur.</p></div>

In words:

1. **All or nothing.** A connector exposes whatever the server offers. You can't keep the reads and drop `merge_pull_request`.
2. **Tools change underneath you.** A server can add or change a tool overnight, and the agent sees it at once, reviewed or not.
3. **The server's words reach the agent.** Tool descriptions are written by the server, and a careless or compromised server can hide instructions in them.
4. **No limits on values or time.** Nothing holds a call to one repository or ends access at 5 pm.
5. **A retry can run a write twice.** If a response is lost after the write happened, nothing records the attempt, so a retry runs it again.
6. **A steered agent can use everything it was given.** Agents read text written by other people. Muse's own confirmation helps, but the lasting limit is how much access exists in the first place.
7. **The same work, once per server.** Protocol handling, sign-in, policy and change tracking are repeated for every server, and credentials and records end up wherever each platform keeps them.

None of this is a flaw in Muse. These are gaps in connecting servers one at a time, with nothing in between that you control.

And there's one more problem hiding behind all seven. To close these gaps you need a policy, and nobody wants to write one by hand: ticking forty tool names is exactly how policies end up too broad. You'd rather say the sentence from the scenario and let the agent work out the details. But the agent is the very thing the policy is for. How do you let it write the policy without letting it grant itself access?

---

## Introducing the Muse MCP Adapter {#adapter}

The [Muse MCP Adapter](https://github.com/sept-usc/muse-mcp-adapter) is an open-source gateway built at [SEPT Lab](https://septlab.com/) (Security, Privacy, and Trust) at the University of Southern California to close those gaps. When this post says "we", it means the team at SEPT Lab.

It runs on a machine you own and sits between Muse and your MCP servers. Toward Muse it's an ordinary REST API with an OpenAPI description, so Muse adds it like any connector. Toward each server it's a careful MCP client. In between, it applies your policy, with your credentials, and keeps the record.

<div class="mma" data-widget="hero"><p class="mma-fallback">Interactive figure: calls from Muse flow through the adapter. Approved ones reach the servers, the rest are refused at the adapter.</p></div>

It's built around one idea: **the agent writes the policy, but only you can grant it.** You tell Muse what you want in a sentence. Muse drafts the smallest policy that does the job. You approve it on a page of your own, with your owner password. After that, every call is checked against what you approved.

### The rule everything else follows

> The agent may draft any policy, but only the owner can make access wider, and only for exactly what the owner saw.

That breaks down into four rules:

1. **Nothing is exposed until the owner publishes it.** Discovery, drift checks and proposals never change what Muse can call.
2. **Widening is a human act, tied to what the human saw.** It takes the owner password on the adapter's own page, and the approval is bound to a digest of that page.
3. **Narrowing is free.** Switching an operation off, adding a limit, ending access sooner or disconnecting can only reduce access, so the agent may do it alone, at once.
4. **The live contract can't be changed.** What Muse may call is a compiled, versioned catalog. A server can't change it, and neither can a request.

### Each problem, and its answer

| Problem today | What the adapter does | Read more |
|---|---|---|
| All or nothing | Only the operations you approved exist for Muse | [Frozen contract](#frozen-contract) |
| Tools change underneath you | The published contract stays fixed; changes show up as drift for you to review | [Frozen contract](#frozen-contract) |
| The server's words reach the agent | Descriptions are pinned at publish, and server text stays on your review page | [Draft, don't grant](#draft-not-grant) |
| No limits on values or time | Argument limits and end times, checked on every call | [Every call](#every-call) |
| A retry runs a write twice | Writes are recorded first, replayed on retry, and blocked when the outcome is unknown | [Writes run once](#writes-once) |
| A steered agent | The agent can only narrow; every widening waits for your password | [Narrow now, widen later](#narrow-widen) |
| The same work per server | One gateway for every server, one place for credentials and records | [Where it runs](#where-it-runs) |
| Nobody wants to write the policy | Muse drafts it from the service's real details; a deterministic compiler checks it | [Draft, don't grant](#draft-not-grant) |

Any remote MCP server over Streamable HTTP works, including one you wrote. About 34 well-known services (Linear, GitHub, Atlassian, Sentry, Notion, Slack, Stripe, Supabase and others) can simply be named in chat, with no address needed.

---

## How It Does What It Does {#how}

The rest of this post walks through the parts of the adapter, and each one says which problem it answers.

### The shape of the thing {#shape}

The adapter is one gateway process, built as a modular monolith: a control plane, a data plane and an optional setup surface, with one local store and an owner-held secret store. Tap any box, or trace a request through it.

<div class="mma" data-widget="arch"><p class="mma-fallback">Interactive figure: the adapter's components. Muse and the owner on the left, the setup connector, review pages, control plane, catalog, data plane, credentials and audit inside, MCP servers on the right.</p></div>

There are three contracts, one at each edge. **Toward Muse**: stable REST operations described in OpenAPI. **Inside**: a provider-neutral model of servers, primitives, policies, catalogs, connections, operations, drift and audit. **Toward servers**: MCP, exactly as the spec defines it.

The unit of isolation is a **connection**: one link between Muse and exactly one MCP server, with its own connector URL, token, policy, catalog and credential. Connect a second server and you get a second connection, inside the same process.

### MCP in, OpenAPI out {#translate}

> **Answers:** the same work, once per server.

Muse reads OpenAPI. MCP servers speak MCP. The adapter does the translation once, for every server, and you never write an API description by hand. Pick a primitive and watch it become an operation Muse can call:

<div class="mma" data-widget="translate"><p class="mma-fallback">Interactive figure: an MCP tool, resource template and prompt next to the OpenAPI operation the adapter generates for each.</p></div>

Every connection exposes the same four routes, and they never change:

| Request | Purpose |
|---|---|
| `GET /c/<slug>/openapi.json` | The description Muse reads; lists only approved operations |
| `POST /c/<slug>/operations/<name>` | Calls one approved tool, resource or prompt |
| `GET /c/<slug>/executions/<id>` | Status, progress and log messages of an earlier call |
| `POST /c/<slug>/executions/<id>/resume` | Answers a question the server asked mid-call |

The description is generated from the approved catalog on every request, so it can only ever list approved operations, and it contains no secrets and no MCP endpoint. The rest of MCP is carried across too: structured output, images, audio and linked content come back as typed content, progress and log messages come back with the result, and when a server asks a question mid-call, Muse gets `409 INPUT_REQUIRED`, asks you, and calls `resume` with your answer. Each feature is checked against a direct MCP client.

### From a live server to a frozen contract {#frozen-contract}

> **Answers:** all or nothing; tools change underneath you.

The control plane turns "whatever the server offers right now" into "exactly what the owner approved". Step through it and watch GitHub's tools change state.

<div class="mma" data-widget="pipeline"><p class="mma-fallback">Interactive figure: register, discover, snapshot, policy, compile, publish.</p></div>

Every published operation compiles to a fixed mapping:

```text
connector ID · catalog version · public operation ID
MCP server registration ID · primitive type and name
approved schema digest · policy classification
required authorization profile and scopes · result and lifecycle policy
```

There's no generic `invoke(server, tool, arguments)` operation anywhere. Muse can call `add_issue_comment` on one connection because that exact mapping was compiled and published, and for no other reason. Anything you didn't approve simply doesn't exist for Muse.

- **Annotations are evidence, not permission.** A tool without `readOnlyHint: true` can't be classified as a read without an explicit review flag. Tools that look destructive (a `destructiveHint`, or a word like delete or merge in the name) are drafted as sensitive writes.
- **Descriptions are pinned when you publish**, so a server can't later change what Muse is told about a tool.
- **The four primitives stay separate.** A resource is never quietly turned into a tool, and fetching a prompt never authorizes the tool calls it mentions.
- **Drift is visible, not automatic.** When a server changes, `drift` reports each difference by kind and severity. Nothing reaches Muse until you publish a new version, and `rollback` gets you back to the previous one.

### Letting the agent draft without letting it grant {#draft-not-grant}

> **Answers:** nobody wants to write the policy; the server's words reach the agent.

With setup by chat, you add exactly **one** connector to Muse by hand: the adapter's setup connector. Every server after that is a conversation. The setup connector has 13 operations, and their names describe everything it can do:

| Group | Operations |
|---|---|
| Look up | `how_setup_works` `find_server` `list_connections` `explain_connection` `get_service_details` `get_proposal_status` |
| Propose | `propose_connection` `revise_proposal` `propose_change` |
| Narrow | `turn_off_operations` `limit_arguments` `expire_access` `remove_connection` |
| Not there at all | anything that publishes, activates, links, stores a secret or widens |

An agent steered by a hostile web page can call all 13 and still not gain a single new permission. Here's the full flow. Step through it: each step says which attack it closes.

<div class="mma" data-widget="sequence"><p class="mma-fallback">Interactive figure: the 14 steps of connecting GitHub by chat, between you, Muse, the setup connector, the review page and the GitHub MCP server.</p></div>

Three things keep a misled agent from widening anything.

**The compiler is deterministic.** It never reads the service's descriptions or your words. It checks the exact names Muse sent against a frozen snapshot of what the service offers, reports anything it can't match, and turns the rest into policy. The language model is used where it's good, turning "issues and PRs, nothing that deletes" into a selection, and kept away from the place where a mistake would widen access.

**The service's own text never reaches Muse before you approve.** Muse gets names and labels the adapter worked out. The service's descriptions only appear on your page, escaped and marked as the service's words. Invisible and direction-changing characters are stripped from anything the agent sends, so what you read is what gets recorded.

**Approval is a typed secret, tied to what you saw.** Unlocking a review page gives you 30 minutes to read, and reading approves nothing. **Approve** asks for the password again, every time. The approval is bound to a digest of the page, so if anything changed since it was rendered, it's refused. Five wrong passwords lock the link. The page also shows an **alignment line**: how many things you asked for, how many would become available, and how many nobody asked for.

### Narrow now, widen later {#narrow-widen}

> **Answers:** a steered agent.

This is the rule the whole design rests on, so try it yourself. You're on both sides here: press Muse's buttons on the left, and play the owner on the right.

<div class="mma" data-widget="asymmetry"><p class="mma-fallback">Interactive figure: Muse narrows access instantly, while each widening becomes a proposal that waits for the owner password.</p></div>

Narrowing applies at once and bumps the catalog version. Widening only ever creates a proposal. And "approve my own proposal" doesn't exist as an operation, so it's a plain `404`.

The adapter enforces this where access goes live, not just in the setup handlers: the component that activates a catalog refuses to activate a wider one on the agent's behalf, whoever asks. Changes to one connection are serialized, and before a change goes live the adapter checks that the live catalog is still the one the change was built from. If that sounds like the classic lost update from [Concurrency in Databases]({{ '/blog/concurrency-in-databases/' | relative_url }}), it is: a lock plus a version check, applied to policy instead of rows.

There's no per-call approval. A denied operation stays denied until the policy is widened through this process, and Muse's own confirmation of writes still applies on top.

### Seven checks on every call {#every-call}

> **Answers:** no limits on values or time; all or nothing.

Pick a request and send it through the checks:

<div class="mma" data-widget="gates"><p class="mma-fallback">Interactive figure: seven checks on every call, and where each example request stops.</p></div>

Anything that fails steps 1 to 3 is refused before the server is contacted.

**Argument limits.** A tool can be held to a list of values, or to a short pattern that the whole value must match. Leaving the argument out is refused too, otherwise omission would be a way around the limit. A list argument passes only if every item is allowed. Muse is told about the limit, and the argument becomes required. An operation with a limit only accepts the arguments its schema declares, so a made-up alias can't say the same thing. A pattern whose repeated group itself repeats, like `(a+)+$`, is refused the moment it's proposed.

Limits also can't be dodged by how a value is written. A service resolves a path like `.../azure/../dotnet/`, so a plain pattern match isn't enough. Try a few values against a limit that should only allow pages under `/guides/azure/`:

<div class="mma" data-widget="traversal"><p class="mma-fallback">Interactive figure: a URL limit checked by a plain pattern match and by the adapter.</p></div>

When a pattern names a place, the adapter checks every reading of the value (as written, with Unicode folded, and with each layer of percent-escapes removed) and refuses dot segments, backslashes, encoded dots or slashes and control characters.

**Access that ends.** Every call checks the adapter's own clock, so nothing has to run for access to end, and an unreadable end time counts as already ended. A time window from chat starts when you press Approve, not when Muse asked, and is capped at 30 days. After the end, the operations disappear from what Muse reads.

**Results are untrusted.** They're checked against the published schema, MIME type and size before going back to Muse, and resource URIs can't use `file:` or `data:`.

### Writes that run once {#writes-once}

> **Answers:** a retry runs a write twice.

Agents retry. Networks drop responses. So in the adapter a write isn't a function call, it's a small state machine, and it's recorded **before** the downstream call starts. Go ahead and break it:

<div class="mma" data-widget="writes"><p class="mma-fallback">Interactive figure: PENDING, RUNNING, COMPLETED, FAILED, UNKNOWN and reconcile.</p></div>

- A repeated write is **replayed, not re-run**. Muse's `Idempotency-Key` is honoured, and without one an identical write counts as a retry while the first one runs or for 30 seconds after.
- A failure **before** anything was sent is safe to repeat and says so: `503` with `Retry-After`.
- If the adapter can't tell whether a write happened, it becomes `UNKNOWN`, and retries get `409 UNKNOWN_OUTCOME` until you check the other system and run `reconcile`.
- Every error carries `retryable` and `nextStep`. That small contract matters more for an agent than for a person, because it's what stops a well-meaning retry loop from doing harm.

### Where it runs {#where-it-runs}

> **Answers:** the same work, once per server; credentials and records scattered.

```text
Muse ──(connector token)──▶ Adapter ──(this connection's own credential)──▶ MCP server
```

There are two separate authentication boundaries. Muse holds one revocable token per connector, and it only works on that connector. Each connection has its own downstream credential: none, a token in a root-only file, or your OAuth sign-in with the tokens encrypted at rest. In chat setup you type the service token on the adapter's page, so it never passes through the chat, and Muse never sees it.

The deployment tool, `muse-vm`, puts one adapter on one machine you control: a new Google Cloud VM, an existing Linux box over SSH, or the machine it runs on.

- **One way in: Tailscale Funnel.** Muse needs a public HTTPS address with a real name. Funnel gives one while the machine has no public IP and accepts no inbound connection.
- **Built on the target.** From the code you installed, with hash-locked dependencies and base images pinned by digest.
- **An egress guard owns the network.** The cloud metadata server and private ranges are blocked, so even a compromised adapter can't borrow the machine's cloud identity.
- **Unprivileged and read-only.** No capabilities, and setup ends with a self-check from outside and inside the machine.

There's no shared service in the middle. Each deployment serves one owner.

### The paper trail {#paper-trail}

> **Answers:** knowing what happened, and why it was allowed.

There are two logs, both on your machine. The **runtime audit** records every call along with the catalog version that answered it. The **administrative audit** records every change, and each row carries a hash of the row before it. Below are the real events from one widening in a recorded session. Tamper with them and see what happens.

<div class="mma" data-widget="chain"><p class="mma-fallback">Interactive figure: a hash-chained audit log that breaks visibly when a row is edited or deleted.</p></div>

Together the two logs give you a walk that's usually impossible with agent tooling: `explain-call` takes a call to its catalog version, the proposal behind it, your words as Muse relayed them, and your approval. If you note the head hash somewhere else, `audit-verify --head HASH` also catches rows cut off the end.

---

## See It in Action {#in-action}

Here's what using it actually looks like. This session was recorded with real Muse, in a fresh chat, against a private GitHub repository, through a deployed adapter. The GitHub token behind the adapter could write to that repository, so for writes the adapter was the only thing in the way. The prompts are plain: none of them tell Muse which connector to use.

<div class="mma" data-widget="replay"><p class="mma-fallback">Interactive figure: a real session step by step, each with the chat, what the adapter recorded, and what GitHub showed.</p></div>

Compare it with the problems from earlier. The write that wasn't approved didn't exist. The one comment that was approved ran exactly once. The repository limit held. The hostile issue changed nothing: Muse's own safeguards held, and they deserve the credit, but the adapter would have stopped it regardless, because no merge or delete tools were published and a widening only creates a proposal that waits for the owner's password. And when the hour was up, access ended even though the machine had been switched off in between, because every call checks the clock.

The deployed adapter was also sent 188 hostile requests directly, from tokens used on the wrong connection to password guessing on the review page. Each one was refused where it should be.

---

## Getting Started {#getting-started}

You need a computer with Python 3.12+ and `ssh`, a free [Tailscale](https://tailscale.com) account, and somewhere to run the adapter: a Google Cloud project, a Linux machine you can SSH into, or the Linux VM itself.

```bash
pipx install git+https://github.com/sept-usc/muse-mcp-adapter
muse-vm setup --chat-setup
```

Setup takes about 5 to 10 minutes. It builds and starts the adapter, gives it a public HTTPS address through Tailscale Funnel with nothing open on the machine, and asks you to click one Tailscale sign-in link. It's safe to run again if anything stops half way. At the end it prints, once each, a sentence to give Muse with a token, and your owner code.

1. **Add the one connector by hand.** In a new Muse chat, send the sentence, click **Connect**, and paste the token into Muse's own secure field.
2. **Choose your owner password** (optional, recommended): `muse-vm chat-setup --set-owner-password`. You only ever type it on your adapter's own review pages, never into Muse.
3. **Ask Muse.** For example: *"Connect my GitHub repository OWNER/REPO. Read, commit, open pull requests and create issues, but nothing that deletes. Three hours."* Then follow the link Muse gives you.

From there, the repository has a [step-by-step guide for connecting GitHub](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/connect-github-to-muse.md), the [full chat-setup flow](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/chat-setup.md), and the [security model](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/security.md).

---

## At a Glance {#at-a-glance}

| Idea | What it means in practice |
|---|---|
| Split drafting from granting | The agent proposes; a deterministic compiler and the owner's password decide |
| Freeze the truth first | Snapshot what a service offers, with a digest, before anyone reasons about it |
| Translate once | Every MCP server becomes an OpenAPI connector, with no hand-written descriptions |
| Narrowing is free | Off, limit, end sooner, disconnect: instant, no approval |
| Widening is a proposal | One operation at a time, password every time, bound to the page digest |
| The contract is compiled | One fixed mapping per operation, no generic invoke |
| Writes are a state machine | Replayed, never re-run; `UNKNOWN` blocks blind retries |
| You keep custody | Your machine, your credentials, your audit trail |

---

## Wrapping Up {#wrapping-up}

Connecting an agent straight to each MCP server gives it access, but not the shape of access you actually want: which operations, which values, which direction, how long. The Muse MCP Adapter puts a layer you own in between, and lets the agent do the tedious part, turning your sentence into a precise policy, while the one step that matters stays with you.

Narrowing stays free, so the agent can always make things safer on its own. Widening always comes back to a person.

Let the agent write the policy. Keep the signature for yourself.

*The Muse MCP Adapter is open source (MIT) and developed at [SEPT Lab](https://septlab.com/), USC, as part of the lab's work on AI agent security. The code, the design notes and the full documentation are on [GitHub](https://github.com/sept-usc/muse-mcp-adapter).*

<script src="{{ fig }}/widgets.js" defer></script>
