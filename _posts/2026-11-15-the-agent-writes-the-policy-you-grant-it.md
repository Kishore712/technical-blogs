---
layout: post
title: "Muse MCP Adapter: Connect Your Tools, Control the Access"
date: 2026-11-15
reading_time: "15 min read"
tags: [AI Agents, MCP, Security, Open Source]
excerpt: "Let Muse propose access to your tools, review it yourself, and have a gateway you run enforce what you approved. Follow a GitHub workflow to see how it works."
---

{% assign fig = '/B-ai-agents/B1-Muse-MCP-Adapter/interactive' | relative_url %}
<link rel="stylesheet" href="{{ fig }}/widgets.css">

## A useful task, with clear boundaries {#scenario}

Suppose you want an AI agent to help maintain a GitHub repository. It should read issues and pull requests, help you work out what needs attention, and perhaps add a comment later.

You might describe the job like this:

> Read the issues and pull requests in my repo. Maybe comment on one later. Never merge, never delete, never touch my other repositories. And only for this afternoon.

That sentence describes both the work and its boundaries. You want to decide **what the agent can do, where it can do it, who can add access, and when access ends**. Tap each part of the request to explore those decisions.

<div class="mma" data-widget="sentence"><p class="mma-fallback">The request contains four kinds of rule: permitted operations, permitted argument values, owner approval for more access, and an end time.</p></div>

[Muse MCP Adapter](https://github.com/sept-usc/muse-mcp-adapter) helps turn those boundaries into an access policy you can review and enforce. It is an open-source gateway developed at [SEPT Lab](https://septlab.com/) at the University of Southern California.

## Muse drafts. You approve. The adapter enforces. {#adapter}

Muse is a personal AI agent that adds services through Custom Connectors. MCP, short for Model Context Protocol, is a standard that lets services offer tools and data to AI applications.

The adapter connects the two. You run it on a machine you control. It presents an OpenAPI-based connector to Muse, talks MCP to the remote server, and checks requests against your approved policy.

<div class="mma" data-widget="hero"><p class="mma-fallback">Muse sends requests to your adapter. Requests that pass the approved operation, argument and expiry checks can reach the MCP server. Requests outside those limits are refused.</p></div>

You describe the task in ordinary language. Muse proposes the operations it thinks the task needs. You review the selection on the adapter's own page, approve it with your owner password, and complete the connection in Muse.

A **policy** is simply the operations and limits you allow. Muse can propose a policy, but the proposal cannot activate broader access on its own.

The figures throughout this article are interactive. They are simulations and walkthroughs you can explore in your browser; they do not connect to your accounts or change anything in GitHub.

## Follow the GitHub workflow {#in-action}

Start with a fine-grained GitHub token restricted to the intended repository and the service permissions needed for the job. The adapter adds its own restrictions within the access that token permits.

After adding the adapter's setup connector to Muse, ask it to prepare the repository connection. Muse gives you a review link. Open it in your own browser, enter your owner password, and provide the GitHub token on that page.

The adapter records what the GitHub MCP server advertises. Muse uses a cleaned, labelled view of those capabilities to propose a policy. Review the actual operations, repository limits and end time. Type your owner password again to approve, then click Connect in Muse and enter the separate connector token shown by the page.

Step through the reconstructed walkthrough below. Each panel pairs a user request with the corresponding adapter events and the outcome to look for. Chat text and events are condensed examples, rather than a live session or a verbatim transcript.

<div class="mma" data-widget="replay"><p class="mma-fallback">Ask for read access, approve it on your own page, try an unavailable write, approve commenting separately, remove it, limit tools to one repository, and let access expire.</p></div>

| You ask Muse to… | What happens through the approved connection |
|---|---|
| Read issues in the permitted repository | The approved read operation can run |
| Add a comment before commenting is approved | The comment operation is unavailable |
| Read another repository | Restricted repository arguments are refused |
| Make another call after access expires | The adapter refuses the call |

If commenting becomes useful, Muse can propose adding that operation with a reason. You review the change and its limits before approving it. Approving the capability permits calls within its policy; confirmation of an individual comment in Muse is a separate step.

When the task is done, ask Muse to turn commenting off again. Reducing access can take effect immediately. Adding access requires your approval.

## Why add another layer? {#today}

Muse and the services you connect already have permissions and safeguards. Muse has its own credential storage and action-confirmation settings, while a service such as GitHub can restrict a token's permissions and repository access.

The adapter adds a consistent policy layer in an environment you control. It is especially useful when you want to review the exposed operations, apply supported argument limits, make access temporary, and manage interface changes across several MCP connections.

Explore the examples below. They illustrate what can happen **when a connection lacks the particular control being shown**. The controls in an actual direct connector depend on that connector and service; the animation is not a claim that every direct connection behaves this way.

<div class="mma" data-widget="today"><p class="mma-fallback">Example risks include overly broad operations, unreviewed interface changes, untrusted descriptions, missing argument or time limits, duplicate writes after retries, excessive existing permissions, and repeated integration work.</p></div>

The adapter brings those concerns together:

| What you want | What the adapter adds |
|---|---|
| Share part of a service | A published list of approved operations |
| Restrict a tool's inputs | Supported argument-value limits and expiry checks |
| Review interface changes | A versioned catalog and explicit publication |
| Keep service credentials in your environment | Separate credentials for Muse and the downstream server |
| Handle write failures carefully | Tracked operations, recognized retries and manual reconciliation of uncertain outcomes |
| Avoid hand-writing each connector description | Shared MCP-to-OpenAPI translation |

The following sections let you explore how these pieces work. All the examples stay on this page, so you can move between the user workflow and the implementation behind it.

## One gateway, separate connections {#how}

### Trace a request through the adapter {#shape}

The adapter runs as one gateway process. Its setup pages help you review proposals; its control plane records and publishes policies; its data plane checks and executes requests. Credentials, operation records and audit data stay in the environment where you run it.

Tap a component, or trace a call or setup through the diagram.

<div class="mma" data-widget="arch"><p class="mma-fallback">Muse calls the data plane, which checks the published catalog, uses the connection's credential, contacts the MCP server and records the outcome. The owner approves setup changes on separate review pages.</p></div>

A **connection** links Muse to one MCP server. It has its own connector URL, token, policy and downstream credential. Adding another server creates another connection within the same gateway, rather than one unrestricted credential for everything.

### MCP in, OpenAPI out {#translate}

MCP servers can offer tools that perform actions, resources containing data, resource templates with parameters, and prompts containing reusable messages. The adapter keeps those categories distinct while making approved capabilities available through Muse's connector API.

Pick an example and watch its connector operation appear.

<div class="mma" data-widget="translate"><p class="mma-fallback">An approved MCP tool, resource template or prompt becomes a specific OpenAPI operation. The adapter adds the policy classification and, for writes, confirmation and retry information.</p></div>

These are the core routes used for calls:

| Request | Purpose |
|---|---|
| `GET /c/<slug>/openapi.json` | The connector description Muse reads |
| `POST /c/<slug>/operations/<name>` | Invoke an approved operation |
| `GET /c/<slug>/executions/<id>` | Inspect a call's status, progress and logs |
| `POST /c/<slug>/executions/<id>/resume` | Answer a question raised during a call |

The service also has routes for artifacts, authentication and, when enabled, review pages. Structured results, images, audio and linked content use typed responses. A server question can become `409 INPUT_REQUIRED`, followed by a resume request carrying the answer.

The [validation guide](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/validation.md) describes what is tested and the differences from a direct MCP connection. Features such as subscriptions, completion and sampling are not available through the REST contract.

## Approve a stable interface {#frozen-contract}

Discovery records what a server advertises. Publication determines which of those capabilities Muse can use through the connector. A newly discovered tool does not become available automatically.

Step through the process and watch the selected tools become a published catalog.

<div class="mma" data-widget="pipeline"><p class="mma-fallback">Register the server, discover its advertised capabilities, save a snapshot, select a policy, compile specific mappings and publish the approved catalog.</p></div>

The published catalog records the operation names, descriptions, schemas, classifications and limits. Muse receives a connector description generated from that approved version. A runtime call cannot substitute an arbitrary server or tool for the published mapping.

When you run a drift check, the adapter compares a fresh discovery with the published catalog. You can inspect differences before publishing an update or roll back to an earlier version.

This preserves the interface you approved. It does not freeze the remote service's implementation or prove that its descriptions and read-only labels are accurate. Those are still claims from the service and need appropriate trust and review.

## Let Muse propose, keep approval with you {#draft-not-grant}

Add the adapter's setup connector once. After that, ask Muse to prepare new connections or changes. You still authorize the service, approve the policy, and complete the new connection in Muse.

The setup connector has 13 operations for looking things up, drafting proposals, explaining connections and reducing access. It has no operation that lets Muse approve its own proposal or activate wider access.

Follow the full sequence, from the first request to the Connect card.

<div class="mma" data-widget="sequence"><p class="mma-fallback">Muse proposes a connection. The owner connects the service on a review page. Muse reads recorded capabilities and drafts operations. The owner reviews and approves with a password, then connects the result in Muse.</p></div>

Three details matter here.

**Muse drafts from recorded capabilities.** The adapter saves a snapshot of what the service advertises. Muse receives bounded, cleaned descriptions and structured details labelled as untrusted service data. Cleaning this text does not guarantee that it cannot influence Muse.

**The compiler checks the draft.** A deterministic compiler checks exact names and policy structure against the snapshot. It does not prove that Muse chose the minimum permissions or understood your intent correctly. Review the proposed selection, including the reads.

**Your approval is tied to the reviewed proposal.** Opening the page allows you to read it; approving asks for the owner password again. Approval is bound to the proposal digest, so a changed proposal must be reviewed again. Five wrong passwords temporarily lock the link.

The important separation is that even a mistaken or influenced proposal cannot activate broader access without the owner's approval through this flow.

### Make access smaller now; review additions {#narrow-widen}

Try both sides of that rule. Use Muse's controls to remove access or request another operation, then use the owner panel to approve or decline the proposal. The password shown in the figure is only for this local simulation.

<div class="mma" data-widget="asymmetry"><p class="mma-fallback">Muse can turn an operation off or tighten access. Adding an operation creates a proposal that waits for the owner password. The setup connector has no self-approval operation.</p></div>

This rule is checked when a catalog becomes active, as well as in the setup flow. A change that the adapter cannot establish as no wider must go through owner review.

Policy approval is separate from action confirmation. The adapter enforces the published policy; Muse's own settings and behavior determine its confirmations before individual actions.

## What gets checked when Muse calls a tool? {#every-call}

Choose a request and follow it through the checks. Try a permitted read, another repository, a missing token or an expired connection.

<div class="mma" data-widget="gates"><p class="mma-fallback">The adapter checks identity, published access and expiry, valid inputs and limits, retry state, downstream execution, the result, and the applicable audit and operation records.</p></div>

**Arguments must meet the approved limits.** A supported tool argument can be restricted to listed values or a pattern. Omitting a restricted argument is refused too. A repository restriction should cover the relevant owner and repository arguments, alongside a suitably restricted GitHub token.

These chat-configured limits apply to tools. They do not automatically restrict prompts or resource templates taking similar arguments. Newly approved operations do not inherit every existing argument limit, so review those additions independently. The review page identifies restrictions it cannot enforce.

### A matching string can still name the wrong place {#traversal}

A URL such as `/guides/azure/../dotnet/` can look as though it starts in one directory while resolving to another. Try the examples below to see why the adapter checks for ambiguous path representations as well as a pattern match.

<div class="mma" data-widget="traversal"><p class="mma-fallback">A plain prefix pattern can accept a URL containing a parent-directory segment. The adapter's additional path checks refuse the ambiguous value.</p></div>

For patterns that name a location, the implementation checks normalized and decoded forms for dot segments, encoded separators, backslashes and control characters. The figure is a simplified illustration of those checks.

**Expiry is checked when calls arrive.** A time window requested through chat starts at approval. Once it ends, new calls are refused and expired operations are left out when the connector description is refreshed. A paused call cannot be resumed after its access expires. This depends on the adapter's clock being correct.

**Results have limits too.** The adapter applies the relevant schema, content-type and size checks before returning a response. Validating a result's structure does not make the text inside it trustworthy instructions.

## Retries without blindly repeating writes {#writes-once}

A comment can be created even if its response gets lost. Repeating the request without knowing what happened can create another comment.

The adapter records a write before dispatch and tracks its state. Try a successful write, a failure before sending, and a lost response.

<div class="mma" data-widget="writes"><p class="mma-fallback">Recognized retries can replay a stored result. A failure before dispatch is retryable. An uncertain outcome becomes UNKNOWN, requiring the owner to check the service and reconcile it.</p></div>

- **Recognized retries reuse the operation.** With the same caller-supplied `Idempotency-Key`, the stored operation is reused while retained. Without a key, identical requests are treated as retries while in progress or uncertain, or for 30 seconds after completion by default. A later completed request can be treated as a new action.
- **A failure before dispatch can be retried.** The response identifies a safely retryable failure, such as `503` with `Retry-After`.
- **An uncertain outcome needs a check.** The operation becomes `UNKNOWN`; retries of that operation are blocked until you inspect the downstream system and reconcile it.

These rules help an agent handle failure deliberately. They are not a universal guarantee that every differently worded request can be recognized as the same action.

## Your machine, credentials and record {#where-it-runs}

There are two separate authentication relationships. Muse uses a revocable token for one adapter connection. The adapter uses that connection's own credential to reach the MCP server. A service token entered on the review page stays with the adapter.

The deployment tool, `muse-vm`, can set up a Google Cloud VM or an existing Linux machine. Tailscale Funnel provides the public HTTPS address without requiring the adapter's port to be opened directly to the internet.

The deployment includes an unprivileged adapter container, a read-only root filesystem, pinned build inputs and an egress guard that blocks private and metadata addresses by default. These controls support operating the gateway; you remain responsible for its accounts, maintenance and hosting costs.

### Trace how access changed {#paper-trail}

Runtime audit records cover authenticated operation requests, while the administrative audit records changes such as proposals and catalog activation. A catalog version links a call to the policy that allowed it.

Try editing or deleting a row in this example administrative log, then run its verification.

<div class="mma" data-widget="chain"><p class="mma-fallback">Each example audit row includes the previous row's hash. Editing or removing an interior row breaks verification. Saving a head hash elsewhere helps detect later truncation.</p></div>

The real administrative chain uses cryptographic hashes; the figure uses short illustrative hashes. A chain can expose edits relative to retained records or an externally saved head. It cannot prevent someone with full control of the machine from rebuilding a chain.

The adapter's `explain-call` and `explain-change` commands help follow a request back through the catalog and proposal behind it. See [chat setup and the audit record](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/chat-setup.md#the-record).

## Is it a fit for you? {#scope}

The adapter is designed for remote MCP servers over Streamable HTTP. Its directory includes addresses and sign-in information for services such as GitHub, Linear, Atlassian and others. A directory entry helps with setup; it is not a guarantee that every provider capability has been tested end to end.

Each deployment serves one owner. You need a Linux service running in your environment, and some providers require additional authorization setup. Local `stdio` servers and MCP Apps rendering are outside scope. The reviewed release is `0.1.0`, classified as alpha in the project metadata.

The policy governs requests passing through this adapter. Muse's own browser, unrelated connectors and other routes to a service remain separate. Restrictions on request arguments also depend on the remote service honoring their meaning.

For a simple connection whose existing controls meet your needs, the extra service may add little value. The adapter becomes more useful when you want to own a consistent approval and enforcement layer across MCP connections.

## Start with one repository {#getting-started}

You need Python 3.12+, `pipx`, SSH, a Tailscale account and somewhere to run the adapter. The Google Cloud path also needs a project and authenticated cloud tooling, as described in the [setup guide](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/getting-started.md).

```bash
pipx install git+https://github.com/sept-usc/muse-mcp-adapter
muse-vm setup --chat-setup
```

The project estimates about 5–10 minutes for guided setup once prerequisites are ready. Setup prints the instructions and token for adding its setup connector to Muse, along with your owner code. Keep that owner code, or replace it with a password using `muse-vm chat-setup --set-owner-password`.

Then ask for a small first connection:

> Connect GitHub so you can read issues and pull requests in OWNER/REPO for one hour. No commenting, merging or deleting.

Review the proposed operations, relevant owner/repository limits and expiry on your adapter's page. Approve the selection, then complete the connection in Muse. Check that a permitted read works, commenting is unavailable, and access ends when expected.

Start with [Connect GitHub to Muse](https://github.com/sept-usc/muse-mcp-adapter/blob/main/docs/connect-github-to-muse.md). The [project repository](https://github.com/sept-usc/muse-mcp-adapter) contains the MIT-licensed code, documentation and security model.

<script src="{{ fig }}/widgets.js" defer></script>
