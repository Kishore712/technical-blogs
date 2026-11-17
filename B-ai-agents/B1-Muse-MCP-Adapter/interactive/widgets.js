/* Interactive figures for "The Agent Writes the Policy, You Grant It".
   Each <div class="mma" data-widget="NAME"> in the post is replaced by a live figure.
   The figures are simulations of the adapter's rules; captions say what is an example. */
(function () {
  "use strict";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";
  function q(r, s) { return r.querySelector(s); }
  function qa(r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function stepper(root, n, go, ms) {
    var cur = 0, timer = null, playBtn = q(root, "[data-play]");
    function stop() { if (timer) { clearInterval(timer); timer = null; if (playBtn) playBtn.textContent = "Play"; } }
    function to(i) { cur = Math.max(0, Math.min(n - 1, i)); go(cur, !!timer); }
    var nx = q(root, "[data-next]"), pv = q(root, "[data-prev]");
    if (nx) nx.addEventListener("click", function () { stop(); to(cur + 1); });
    if (pv) pv.addEventListener("click", function () { stop(); to(cur - 1); });
    if (playBtn) playBtn.addEventListener("click", function () {
      if (timer) { stop(); return; }
      playBtn.textContent = "Pause"; timer = setInterval(function () { if (cur >= n - 1) { stop(); return; } to(cur + 1); }, ms); to(0);
    });
    return { to: function (i) { stop(); to(i); } };
  }
  var W = {};

  /* ---------------- hero: calls flowing through the adapter ---------------- */
  W.hero = function (root) {
    root.innerHTML = '<svg role="img" aria-label="Calls from Muse pass through the adapter. Approved calls continue to MCP servers; others are refused at the adapter."><g class="s"></g><g class="p"></g></svg>' +
      '<div class="mma-legend"><span><i class="mma-dot" style="background:var(--ok)"></i>On the approved list: forwarded with the adapter\'s own credential</span>' +
      '<span><i class="mma-dot" style="background:var(--bad)"></i>Not on the list, outside a limit, or expired: refused before the server is contacted</span><span class="cnt" style="font-family:var(--mono)"></span></div>';
    var svg = q(root, "svg"), g = q(root, "g.s"), pk = q(root, "g.p"), cnt = q(root, ".cnt");
    var F = "Inter, system-ui, sans-serif", MONO = "JetBrains Mono, monospace";
    var ops = [["list_issues", 1], ["issue_read", 1], ["merge_pull_request", 0], ["list_pull_requests", 1], ["delete_file", 0], ["add_issue_comment", 0], ["search_code · other repo", 0], ["get_me", 1]];
    var APPROACH = 1.7, PASS = 1.9, BACK = 1.0;
    var L, mode = null, live = [], idx = 0, okN = 0, badN = 0, visible = true, caption, flash, gate, flashTimer = null;
    function bez(p0, p1, p2, p3, t) { var u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }
    function rect(x, y, w, h, strong) { return sv("rect", { x: x, y: y, width: w, height: h, rx: 12, fill: "var(--card2)", stroke: strong ? "var(--acc)" : "var(--line)", "stroke-width": strong ? 2 : 1.5 }, g); }
    function text(x, y, str, size, opt) {
      opt = opt || {};
      var t = sv("text", { x: x, y: y, "text-anchor": opt.anchor || "middle", fill: opt.fill || "var(--ink)", "font-family": opt.mono ? MONO : F, "font-weight": opt.bold ? 600 : 400, "font-size": size }, opt.parent || g);
      t.textContent = str; return t;
    }
    function wire(d, dashed) { return sv("path", { d: d, stroke: "var(--line)", "stroke-width": 2, fill: "none", "stroke-dasharray": dashed ? "4 6" : "none" }, g); }
    function withLengths(pts) { var d = [0]; for (var i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts: pts, d: d, total: d[d.length - 1] }; }
    function at(path, f) {
      var target = Math.max(0, Math.min(1, f)) * path.total, i = 1;
      while (i < path.d.length - 1 && path.d[i] < target) i++;
      var a = path.pts[i - 1], b = path.pts[i], seg = path.d[i] - path.d[i - 1] || 1, k = (target - path.d[i - 1]) / seg;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    function layout() {
      var narrow = root.clientWidth < 560, m = narrow ? "n" : "w";
      if (m === mode) return; mode = m;
      g.innerHTML = ""; pk.innerHTML = ""; live = [];
      if (!narrow) {
        // Wide: Muse, then the adapter with a clear lane through its middle, then three servers.
        svg.setAttribute("viewBox", "0 0 960 320");
        L = { E0: [150, 160], A0: [360, 160], inner: [[620, 160]], servers: [[790, 70, "GitHub"], [790, 160, "Linear"], [790, 250, "Your server"]],
          ctrl: function (s) { return [[705, 160], [705, s[1]]]; }, cap: [255, 132, "middle"], fl: [255, 204, "middle"], bounce: 18 };
        wire("M150 160 L360 160"); wire("M360 160 L620 160", true);
        L.servers.forEach(function (s) { wire("M620 160 C 705 160, 705 " + s[1] + ", 790 " + s[1]); });
        rect(20, 120, 130, 80); text(85, 156, "Muse", 17, { bold: 1 }); text(85, 179, "your agent", 12.5, { fill: "var(--mut)" });
        rect(360, 40, 260, 240, true); text(490, 78, "Muse MCP Adapter", 18, { bold: 1 });
        ["checks the approved policy", "holds your credentials", "retry tracking · audit"].forEach(function (l, i) { text(490, 222 + i * 20, l, 13, { fill: "var(--mut)" }); });
        gate = sv("rect", { x: 357, y: 40, width: 6, height: 240, rx: 3, fill: "var(--acc)" }, g);
        L.servers.forEach(function (s) { rect(790, s[1] - 27, 150, 54); text(865, s[1] - 3, s[2], 15, { bold: 1 }); text(865, s[1] + 16, "MCP server", 12, { fill: "var(--mut)" }); });
      } else {
        // Narrow: Muse beside the adapter, servers in a row underneath.
        svg.setAttribute("viewBox", "0 0 400 400");
        L = { E0: [110, 140], A0: [190, 140], inner: [[290, 140], [290, 250]], servers: [[70, 320, "GitHub"], [200, 320, "Linear"], [330, 320, "Your server"]],
          ctrl: function (s) { return [[290, 290], [s[0], 280]]; }, cap: [10, 86, "start"], fl: [10, 200, "start"], bounce: 14 };
        wire("M110 140 L190 140"); wire("M190 140 L290 140 L290 250", true);
        L.servers.forEach(function (s) { wire("M290 250 C 290 290, " + s[0] + " 280, " + s[0] + " 320"); });
        rect(10, 105, 100, 70); text(60, 136, "Muse", 16, { bold: 1 }); text(60, 157, "your agent", 12, { fill: "var(--mut)" });
        rect(190, 20, 200, 230, true); text(290, 52, "Muse MCP Adapter", 16, { bold: 1 }); text(290, 76, "policy · credentials · audit", 12, { fill: "var(--mut)" });
        gate = sv("rect", { x: 187, y: 20, width: 6, height: 230, rx: 3, fill: "var(--acc)" }, g);
        L.servers.forEach(function (s) { rect(s[0] - 60, 320, 120, 56); text(s[0], 344, s[2], 14, { bold: 1 }); text(s[0], 363, "MCP server", 11.5, { fill: "var(--mut)" }); });
      }
      caption = text(L.cap[0], L.cap[1], "", narrow ? 11.5 : 12.5, { anchor: L.cap[2], mono: 1 });
      flash = text(L.fl[0], L.fl[1], "404 not available", narrow ? 11.5 : 12.5, { anchor: L.fl[2], mono: 1, fill: "var(--bad)" });
      flash.setAttribute("opacity", 0);
      L.paths = L.servers.map(function (s) {
        var pts = [L.A0].concat(L.inner), last = pts[pts.length - 1], c = L.ctrl(s);
        for (var k = 1; k <= 30; k++) { var t = k / 30; pts.push([bez(last[0], c[0][0], c[1][0], s[0], t), bez(last[1], c[0][1], c[1][1], s[1], t)]); }
        return withLengths(pts);
      });
      if (RM) {
        var p = at(L.paths[0], 0.6);
        sv("circle", { r: 7, fill: "var(--ok)", cx: p[0], cy: p[1] }, pk);
        sv("circle", { r: 7, fill: "var(--bad)", cx: L.A0[0] - 30, cy: L.A0[1] }, pk);
        caption.textContent = "merge_pull_request"; caption.setAttribute("fill", "var(--bad)"); flash.setAttribute("opacity", 1);
      }
    }
    function upd() { cnt.textContent = "forwarded " + okN + " · refused " + badN; }
    function spawn() {
      if (!visible || document.hidden) return;
      var o = ops[idx++ % ops.length];
      var c = sv("circle", { r: 7, fill: "var(--acc)", cx: L.E0[0], cy: L.E0[1] }, pk);
      caption.textContent = o[0]; caption.setAttribute("fill", "var(--ink)");
      live.push({ c: c, ok: !!o[1], born: performance.now(), path: L.paths[0], name: o[0] });
    }
    function refuse(p) {
      badN++; upd(); p.c.setAttribute("fill", "var(--bad)");
      if (caption.textContent === p.name) caption.setAttribute("fill", "var(--bad)");
      flash.setAttribute("opacity", 1); gate.setAttribute("fill", "var(--bad)");
      clearTimeout(flashTimer); flashTimer = setTimeout(function () { flash.setAttribute("opacity", 0); gate.setAttribute("fill", "var(--acc)"); }, 800);
    }
    function frame(now) {
      for (var i = live.length - 1; i >= 0; i--) {
        var p = live[i], el = (now - p.born) / 1000, x, y;
        if (el < APPROACH) { var f = el / APPROACH; x = L.E0[0] + (L.A0[0] - L.E0[0]) * f; y = L.E0[1] + (L.A0[1] - L.E0[1]) * f; }
        else if (p.ok) {
          if (!p.counted) { p.counted = 1; okN++; upd(); p.c.setAttribute("fill", "var(--ok)"); }
          var u = (el - APPROACH) / PASS;
          if (u >= 1) { p.c.remove(); live.splice(i, 1); continue; }
          var pos = at(p.path, u); x = pos[0]; y = pos[1];
        } else {
          if (!p.counted) { p.counted = 1; refuse(p); }
          var b = (el - APPROACH) / BACK;
          if (b >= 1) { p.c.remove(); live.splice(i, 1); continue; }
          x = L.A0[0] + (L.E0[0] - L.A0[0]) * b; y = L.A0[1] + (L.E0[1] - L.A0[1]) * b + Math.sin(b * Math.PI) * L.bounce;
        }
        p.c.setAttribute("cx", x); p.c.setAttribute("cy", y);
      }
      requestAnimationFrame(frame);
    }
    layout(); upd();
    window.addEventListener("resize", function () { var before = mode; layout(); if (before !== mode && RM) upd(); });
    if (RM) return;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(root);
    spawn(); setInterval(spawn, 1150); requestAnimationFrame(frame);
  };

  /* ---------------- the request sentence ---------------- */
  W.sentence = function (root) {
    var info = {
      all: "<b>Four kinds of rule in one sentence.</b> Direct connectors and service permissions offer different controls. The adapter brings these four decisions into one policy layer you run.",
      ops: "<b>Which operations.</b> Held by the catalog. An operation that is not published does not exist for Muse, and a call for it gets <code>404 not available</code>.",
      val: "<b>Which values.</b> Held by argument limits. <code>repo</code> may only be <code>service-api</code>. Another value, or no value, is refused before GitHub is contacted.",
      dir: "<b>Who can add access.</b> Held by the asymmetry. Muse may narrow on its own, but adding <code>add_issue_comment</code> is a proposal that waits for the owner's password.",
      time: "<b>How long.</b> Held by expiry. Every call checks the adapter's clock, so access ends even if nothing is running."
    };
    root.innerHTML = '<p class="sent k-all">"<span data-k="ops">Read the issues and pull requests</span> in <span data-k="val">my repo</span>. <span data-k="dir">Maybe comment on one later</span>. <span data-k="ops">Never merge, never delete</span>, <span data-k="val">never touch my other repositories</span>. And <span data-k="time">only for this afternoon</span>."</p>' +
      '<div class="mma-btns"><button data-k="all" class="sel">All four</button><button data-k="ops">Which operations</button><button data-k="val">Which values</button><button data-k="dir">Who can add access</button><button data-k="time">How long</button></div><div class="info" aria-live="polite"></div>';
    var s = q(root, ".sent"), p = q(root, ".info");
    function set(k) { s.className = "sent k-" + k; p.innerHTML = info[k]; qa(root, "button").forEach(function (b) { b.classList.toggle("sel", b.dataset.k === k); }); }
    qa(root, "button").forEach(function (b) { b.addEventListener("click", function () { set(b.dataset.k); }); });
    set("all");
  };

  /* ---------------- architecture ---------------- */
  W.arch = function (root) {
    function n(k, t, s) { return '<button class="node" data-n="' + k + '"><b>' + t + '</b><small>' + s + '</small></button>'; }
    root.innerHTML = '<div class="mma-h"><b>Inside the adapter</b><div class="mma-btns"><button class="pri" data-t="call">Trace a call</button><button data-t="setup">Trace a setup</button></div></div>' +
      '<div class="arch"><div class="side">' + n("muse", "Muse", "REST, one token per connector") + n("owner", "You, the owner", "a browser on your own device") + '</div>' +
      '<div class="box"><span>Muse MCP Adapter · on a machine you run</span><div class="two">' + n("setup", "Setup connector", "look up · propose · explain · narrow") + n("review", "Review pages", "owner password, digest-bound") + '</div>' +
      n("control", "Control plane", "register → discover → snapshot → policy → compile → publish") + n("catalog", "Immutable catalog", "versioned, one fixed mapping per operation") +
      n("data", "Data plane", "ingress → resolver → policy → executor → result checks") + '<div class="two">' + n("vault", "Credentials", "per connection, encrypted") + n("audit", "Audit", "runtime + hash-chained admin log") + '</div></div>' +
      '<div class="side">' + n("servers", "MCP servers", "GitHub, Linear, your own; Streamable HTTP") + '</div></div><div class="info" aria-live="polite"></div>';
    var info = {
      muse: "<b>Muse.</b> Sees an ordinary REST API with an OpenAPI description, one per connection. It holds one revocable token per connector and never receives the downstream credential through this flow.",
      owner: "<b>You.</b> Approve on the adapter's own review pages, on your own device, with the owner password. Muse never sees it.",
      setup: "<b>Setup connector.</b> 13 operations: look up, propose, explain and narrow. Nothing in it publishes, activates, links, stores a secret or widens.",
      review: "<b>Review pages.</b> Show your words (marked unverified), what would become available, an alignment line and what is not enforced. Approve takes the password every time and is bound to a digest of the page.",
      control: "<b>Control plane.</b> Registers servers, discovers what they offer, freezes it as a snapshot, compiles a policy and publishes an immutable catalog. Discovery never changes the live contract.",
      catalog: "<b>Immutable catalog.</b> The only thing the data plane executes. Versioned, with descriptions pinned at publish time and one fixed mapping per operation. Rollback returns to the previous version.",
      data: "<b>Data plane.</b> Authenticates the caller, resolves the operation in the active catalog, checks schema, limits, expiry and rate, calls the server with that connection's credential, validates the answer and records it.",
      vault: "<b>Credentials.</b> One per connection: none, a root-only token file, or OAuth tokens encrypted at rest. A credential cannot be shared between connections.",
      audit: "<b>Audit.</b> Every call, with the catalog version that answered it, and every change, hash-chained. <code>explain-call</code> walks a call back to the words you approved.",
      servers: "<b>MCP servers.</b> Any remote server over Streamable HTTP, including your own. Everything they send is untrusted input."
    };
    var nodes = {}, out = q(root, ".info"), timer = null;
    qa(root, ".node").forEach(function (b) { nodes[b.dataset.n] = b; b.addEventListener("click", function () { if (timer) { clearInterval(timer); timer = null; } show(b.dataset.n); }); });
    function clear() { for (var k in nodes) nodes[k].classList.remove("lit", "cur"); }
    function show(k) { clear(); nodes[k].classList.add("lit", "cur"); out.innerHTML = info[k]; }
    function trace(path, notes) {
      if (timer) clearInterval(timer); clear(); var i = 0;
      function step() {
        if (i >= path.length) { clearInterval(timer); timer = null; return; }
        qa(root, ".node.cur").forEach(function (x) { x.classList.remove("cur"); });
        nodes[path[i]].classList.add("lit", "cur"); out.innerHTML = "<b>Step " + (i + 1) + " of " + path.length + ".</b> " + notes[i]; i++;
      }
      step(); timer = setInterval(step, RM ? 1800 : 1300);
    }
    q(root, '[data-t="call"]').addEventListener("click", function () {
      trace(["muse", "data", "catalog", "vault", "servers", "data", "audit", "muse"], [
        "Muse sends <code>POST /operations/list_issues</code> with its connector token.",
        "The data plane identifies the connection from the token. Identity is never read from the body.",
        "The operation is looked up in the active catalog. Not there: <code>404</code>. Expired: <code>403</code>.",
        "Arguments pass the schema and the owner's limits; the adapter fetches this connection's own credential.",
        "The MCP call goes to GitHub using this connection's credential. Muse uses its separate connector token.",
        "The answer is checked for type, size and schema. Its text remains untrusted data; schema validation does not remove prompt injection.",
        "The call is recorded with the catalog version that answered it.",
        "Muse gets the result, or a clear reason with <code>retryable</code> and <code>nextStep</code>."]);
    });
    q(root, '[data-t="setup"]').addEventListener("click", function () {
      trace(["muse", "setup", "owner", "review", "control", "servers", "control", "setup", "review", "catalog", "muse"], [
        "The owner asks Muse in plain words.", "Muse calls <code>propose_connection</code>. It is a record and a link; nothing is exposed.",
        "The owner opens the link on their own device.", "They type the owner password and the GitHub token on the review page.",
        "The control plane registers the server.", "It lists what GitHub offers, using the owner's credential.",
        "The list is frozen as an immutable snapshot with a digest.", "Muse reads the snapshot and drafts exact names, each with a reason.",
        "The owner reads the summary and approves with the password again.", "The policy compiles into a new catalog version and goes live.",
        "Muse receives the new connector address and shows a Connect card."]);
    });
    show("catalog");
  };

  /* ---------------- control-plane pipeline ---------------- */
  W.pipeline = function (root) {
    var TOOLS = [["list_issues", "read"], ["issue_read", "read"], ["list_pull_requests", "read"], ["pull_request_read", "read"], ["search_code", "read"], ["search_users", "read"], ["get_teams", "read"], ["get_file_contents", "read"], ["add_issue_comment", "write"], ["issue_write", "write"], ["create_pull_request", "write"], ["merge_pull_request", "write"], ["delete_file", "write"], ["push_files", "write"]];
    var POLICY = { list_issues: 1, issue_read: 1, list_pull_requests: 1, pull_request_read: 1, get_file_contents: 1 };
    var ST = [
      ["Register", "The owner names a server by its address. It must be HTTPS, carry no embedded credentials and resolve only to public addresses. Numeric host tricks are refused, and the connection is pinned to the checked addresses.", "https://api.githubcopilot.com/mcp/ · HTTPS, public addresses, pinned"],
      ["Discover", "The adapter connects as an MCP client and lists everything the server offers. This is stored as a candidate and never becomes the live contract by itself.", "a sample of the tools GitHub offers"],
      ["Snapshot", "In chat setup the list is frozen into an immutable snapshot with a digest. The agent drafts from it, the compiler checks against it, the owner reviews it.", "snapshot frozen with a digest"],
      ["Policy", "For each primitive: exposed or not; read, write or sensitive write; timeout and size; argument limits; end time. Annotations such as <code>readOnlyHint</code> are evidence, not authorization.", "snapshot frozen with a digest"],
      ["Compile", "A deterministic compiler turns the policy into fixed mappings. Names that are not in the snapshot are reported, never invented.", "5 mappings compiled · 0 names unmatched"],
      ["Publish", "The catalog goes live as an immutable version. Descriptions are pinned, so the server cannot change what Muse is told. Muse's OpenAPI description is generated from it on every request.", "new catalog version active · 5 operations visible to Muse"]
    ];
    root.innerHTML = '<div class="mma-h"><b>The pipeline, one stage at a time</b><div class="mma-btns"><button data-prev>Back</button><button class="pri" data-next>Next stage</button><button data-play>Play</button></div></div>' +
      '<div class="stages"></div><div class="tools"></div><div class="digest"></div><div class="info" aria-live="polite"></div>';
    var sEl = q(root, ".stages"), tEl = q(root, ".tools"), ctl;
    ST.forEach(function (s, i) { var b = document.createElement("button"); b.className = "stage"; b.textContent = (i + 1) + " " + s[0]; b.addEventListener("click", function () { ctl.to(i); }); sEl.appendChild(b); });
    TOOLS.forEach(function (t) { var d = document.createElement("span"); d.className = "tool"; d.textContent = t[0]; d.dataset.k = t[1]; tEl.appendChild(d); });
    function go(i) {
      qa(sEl, ".stage").forEach(function (b, j) { b.className = "stage" + (j < i ? " done" : "") + (j === i ? " cur" : ""); });
      qa(tEl, ".tool").forEach(function (d) {
        var nm = d.textContent; d.className = "tool"; d.style.display = i === 0 ? "none" : "";
        if (i >= 1) d.classList.add(d.dataset.k);
        if (i >= 2) d.classList.add("frozen");
        if (i >= 3 && !POLICY[nm]) d.classList.add("off");
        if (i >= 5 && POLICY[nm]) { d.classList.remove("frozen"); d.classList.add("pub"); }
      });
      q(root, ".digest").textContent = ST[i][2];
      q(root, ".info").innerHTML = "<b>" + ST[i][0] + ".</b> " + ST[i][1];
    }
    ctl = stepper(root, ST.length, go, 2300);
    ctl.to(0);
  };

  /* ---------------- chat setup sequence ---------------- */
  W.sequence = function (root) {
    var L = ["You", "Muse", "Setup connector", "Review page", "GitHub MCP"], X = [60, 210, 385, 555, 700];
    var S = [
      [0, 1, "Connect GitHub, read only", "<b>You say what you want.</b> Plain words. Muse is told not to guess tool names, because it cannot know them yet."],
      [1, 2, "propose_connection(your words)", "<b>A proposal changes nothing.</b> It is a record plus a link. An unlisted address is not contacted until the owner presses a button, so a steered agent cannot make the adapter probe the network."],
      [2, 1, "review link · nothing exposed", "<b>The answer says so plainly.</b> In the live run Muse said nothing was connected yet, asked the owner to open the link on their own device, and not to paste any token in chat."],
      [1, 0, "open on your own device", "<b>The approval leaves the chat.</b> The review page lives on the adapter, not in Muse's browser."],
      [0, 3, "owner password, then the GitHub token", "<b>Secrets go to the page, never the chat.</b> The token is stored encrypted and never shown to Muse. No setup operation even has a field for one."],
      [3, 4, "list what it offers", "<b>The adapter asks the service itself,</b> once, with the owner's credential."],
      [4, 3, "frozen snapshot + digest", "<b>The advertised interface is recorded with a digest.</b> From here on, the draft, the review and the approval all refer to the same immutable list."],
      [1, 2, "get_service_details", "<b>Muse reads the snapshot:</b> names, argument types and allowed values. Service prose is cleaned, shortened and marked as the service's words."],
      [2, 1, "names · arguments · service prose", "<b>Service text remains untrusted.</b> Muse receives cleaned, bounded descriptions to help draft. An influenced draft still cannot activate wider access without owner approval."],
      [1, 2, "revise_proposal(names + reasons)", "<b>A deterministic compiler checks every name against the snapshot.</b> It never reads descriptions or words. Unmatched names are reported, never guessed."],
      [0, 3, "read summary, password, Approve", "<b>Approval is bound to what you saw.</b> Writes listed first, an alignment line, the password typed again, and a digest check: if the page changed, the approval is refused."],
      [3, 0, "connector address + token, shown once", "<b>A new catalog version goes live.</b> The administrative audit records each step with its actor."],
      [1, 2, "get_proposal_status → ready", "<b>Muse checks before it claims success,</b> and learns the new connector's address from the adapter."],
      [1, 0, "Connect card", "<b>One paste into Muse's secure field.</b> From now on, every call is checked against the catalog the owner approved."]
    ];
    root.classList.add("seq");
    root.innerHTML = '<div class="mma-h"><b>Connecting GitHub by chat</b><div class="mma-btns"><button data-prev>Back</button><button class="pri" data-next>Next step</button><button data-play>Play</button></div></div>' +
      '<div class="scrollx"><svg viewBox="0 0 760 610" role="img" aria-label="Sequence of the chat setup flow"></svg></div><div class="note" aria-live="polite"><div class="num">1</div><div class="txt"></div></div>';
    var svg = q(root, "svg"), ctl;
    L.forEach(function (nm, i) {
      var w = nm.length * 8 + 24;
      sv("rect", { x: X[i] - w / 2, y: 14, width: w, height: 30, rx: 8, "class": "whobox" }, svg);
      sv("text", { x: X[i], y: 34, "text-anchor": "middle", "class": "who" }, svg).textContent = nm;
      sv("line", { x1: X[i], y1: 46, x2: X[i], y2: 600, "class": "lane" }, svg);
    });
    var msgs = S.map(function (s, i) {
      var y = 78 + i * 37, a = X[s[0]], b = X[s[1]], dir = b > a ? 1 : -1;
      var g = sv("g", { "class": "msg", tabindex: "0", role: "button", "aria-label": "Step " + (i + 1) + ": " + s[2] }, svg);
      sv("line", { x1: a, y1: y, x2: b - dir * 8, y2: y }, g);
      sv("polygon", { points: b + "," + y + " " + (b - dir * 10) + "," + (y - 5) + " " + (b - dir * 10) + "," + (y + 5) }, g);
      sv("text", { x: (a + b) / 2, y: y - 6, "text-anchor": "middle" }, g).textContent = (i + 1) + ". " + s[2];
      g.addEventListener("click", function () { ctl.to(i); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctl.to(i); } });
      return g;
    });
    function go(i) {
      msgs.forEach(function (m, j) { m.setAttribute("class", "msg" + (j < i ? " past" : "") + (j === i ? " now" : "")); });
      q(root, ".num").textContent = i + 1; q(root, ".txt").innerHTML = S[i][3];
    }
    ctl = stepper(root, S.length, go, 2600);
    ctl.to(0);
  };

  /* ---------------- narrowing vs widening simulator ---------------- */
  W.asymmetry = function (root) {
    var PW = "orchid-lantern-42", st;
    root.innerHTML = '<div class="sim"><div class="panel"><h4><span>Live catalog · GitHub connection</span><span class="ver" style="font-family:var(--mono)"></span></h4><div class="ops"></div><div class="meta"></div>' +
      '<h4 style="margin-top:.9rem">Muse, through the setup connector</h4><div class="mma-btns ab">' +
      '<button class="nar" data-a="off">Turn off search_code</button><button class="nar" data-a="limit">Limit repo to service-api</button><button class="nar" data-a="expire">End access in 1 hour</button>' +
      '<button class="wid" data-a="wComment">Ask for add_issue_comment</button><button class="wid" data-a="wMerge">Ask for merge_pull_request</button><button data-a="self">Approve my own proposal</button><button data-a="reset">Reset</button></div></div>' +
      '<div class="panel"><h4><span>Your review page</span><span class="pill p-wait pc">0 waiting</span></h4><div class="props"></div><h4 style="margin-top:.9rem">Administrative audit</h4><div class="log" aria-live="polite"></div></div></div>' +
      '<p class="mma-cap">A simulation of the real rules, with the real event names. The demo owner password is <code>orchid-lantern-42</code>. Try a wrong one five times, too.</p>';
    var logEl = q(root, ".log");
    function log(c, t) { var d = document.createElement("div"); d.className = c; d.textContent = new Date().toTimeString().slice(0, 8) + "  " + t; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; }
    function op(id) { return st.ops.filter(function (o) { return o.id === id; })[0]; }
    function init() {
      st = { ver: 1, ops: [{ id: "list_issues", k: "read", on: true }, { id: "issue_read", k: "read", on: true }, { id: "list_pull_requests", k: "read", on: true }, { id: "search_code", k: "read", on: true }, { id: "add_issue_comment", k: "write", on: false }, { id: "merge_pull_request", k: "sensitive write", on: false }], limit: null, ends: null, props: [], fails: 0, locked: false };
      logEl.innerHTML = ""; log("a", "setup.proposal.applied     owner  catalog v1 (4 reads)"); render();
    }
    function render(flashId) {
      q(root, ".ver").textContent = "catalog v" + st.ver;
      q(root, ".ops").innerHTML = st.ops.map(function (o) { return '<div class="op' + (o.on ? "" : " off") + (o.id === flashId ? " flash" : "") + '"><span>' + o.id + '</span><small>' + (o.on ? o.k + (st.limit ? " · repo=" + st.limit : "") : "not available · 404") + '</small></div>'; }).join("");
      q(root, ".meta").innerHTML = "<span>Repository limit: <b>" + (st.limit || "none") + "</b></span><span>Access ends: <b>" + (st.ends || "never") + "</b></span>";
      q(root, ".pc").textContent = st.props.length + " waiting";
      var P = q(root, ".props");
      if (!st.props.length) { P.innerHTML = '<p class="mma-cap" style="margin:0">Nothing is waiting. A widening from Muse appears here as a proposal. It changes nothing until you approve it with the owner password.</p>'; return; }
      P.innerHTML = st.props.map(function (p, i) {
        return '<div class="prop"><span class="pill p-wait">Proposal · change</span><div style="margin:.35rem 0"><b>Asked for now: 1</b> · <code>' + p + '</code><br><span style="color:var(--mut)">Already live and staying: ' + st.ops.filter(function (o) { return o.on; }).length + '. Everything else: not available.</span></div>' +
          '<input type="password" aria-label="Owner password" autocomplete="off" placeholder="owner password"' + (st.locked ? " disabled" : "") + '><div class="err">' + (st.locked ? "Too many wrong tries. This link is locked for a while." : "") + '</div>' +
          '<div class="mma-btns"><button class="pri" data-ap="' + i + '"' + (st.locked ? " disabled" : "") + '>Approve</button><button data-de="' + i + '">Decline</button></div></div>';
      }).join("");
      qa(P, "[data-ap]").forEach(function (b) { b.addEventListener("click", function () { approve(+b.dataset.ap); }); });
      qa(P, "[data-de]").forEach(function (b) { b.addEventListener("click", function () { var id = st.props.splice(+b.dataset.de, 1)[0]; log("a", "setup.proposal.declined    owner  " + id + " (no password needed)"); render(); }); });
      qa(P, "input").forEach(function (inp, i) { inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); approve(i); } }); });
    }
    function approve(i) {
      if (st.locked) return;
      var box = qa(root, ".prop")[i], v = q(box, "input").value, id = st.props[i];
      if (v !== PW) {
        st.fails++; log("r", "setup.approve.failed       wrong owner password (" + st.fails + "/5)");
        if (st.fails >= 5) { st.locked = true; log("r", "setup.approve.locked       this link is locked for a while"); render(); return; }
        q(box, ".err").textContent = "Wrong password. " + (5 - st.fails) + " tries left."; q(box, "input").value = ""; return;
      }
      st.fails = 0; st.props.splice(i, 1); op(id).on = true; st.ver++;
      log("o", "setup.proposal.approved    owner  " + id); log("o", "catalog.publish · catalog.activate  v" + st.ver); render(id);
    }
    qa(root, ".ab button").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.dataset.a;
        if (a === "reset") return init();
        if (a === "off") { var o = op("search_code"); if (!o.on) { log("a", "turn_off_operations: already off"); return; } o.on = false; st.ver++; log("o", "setup.catalog.narrowed     agent  search_code off · v" + st.ver + " live at once"); render("search_code"); }
        if (a === "limit") { if (st.limit) { log("r", "limit_arguments 409: already limits repo to service-api"); return; } st.limit = "service-api"; st.ver++; log("o", "setup.catalog.limited      agent  repo = service-api · v" + st.ver); render(); }
        if (a === "expire") { if (st.ends) { log("a", "expire_access: an end is already set; extending it requires owner approval"); return; } st.ends = new Date(Date.now() + 3600e3).toTimeString().slice(0, 5) + " (in 1 hour)"; st.ver++; log("o", "setup.catalog.expiry       agent  ends in 1 h · v" + st.ver); render(); }
        if (a === "wComment" || a === "wMerge") {
          var id = a === "wComment" ? "add_issue_comment" : "merge_pull_request";
          if (op(id).on) { log("a", "propose_change: " + id + " is already live"); return; }
          if (st.props.indexOf(id) >= 0) { log("a", "propose_change: already waiting for the owner"); return; }
          st.props.push(id); log("w", "setup.proposal.opened      agent  wants " + id + " · nothing changed"); render();
        }
        if (a === "self") { log("r", "POST .../operations/approve_proposal → 404 not available"); log("a", "  the setup connector has no operation that approves or widens"); }
      });
    });
    init();
  };

  /* ---------------- seven checks on every call ---------------- */
  W.gates = function (root) {
    var G = [["1", "Who is calling?", "token → connection"], ["2", "Is it published?", "active catalog, not expired"], ["3", "Is it valid?", "schema, limits, size, rate"], ["4", "Run before?", "idempotency"], ["5", "Call the server", "this connection's credential"], ["6", "Check the answer", "type, size, schema"], ["7", "Record", "audit + state"]];
    var R = [
      { n: "Read an allowed issue", fail: -1, code: "200", body: { status: "COMPLETED", operation: "issue_read", arguments: { owner: "my-org", repo: "service-api", issue_number: 3 }, content: [{ type: "text", text: "Issue #3: CSV export drops the last row ..." }] } },
      { n: "Read another repository", fail: 2, code: "400", body: { error: "REQUEST_VALIDATION_FAILED", message: "Argument repo is limited by the owner to service-api", retryable: false } },
      { n: "merge_pull_request", fail: 1, code: "404", body: { message: "merge_pull_request is not available on this connector.", retryable: false } },
      { n: "Path with ../", fail: 2, code: "400", body: { error: "REQUEST_VALIDATION_FAILED", message: "Argument url is limited by the owner to values matching ..., and this value carries .., which the service could read as another place.", retryable: false } },
      { n: "After access ended", fail: 1, code: "403", body: { error: "AUTHORIZATION_FAILED", message: "The access the owner gave to GitHub ended at 2026-11-03T06:59:28Z. Ask the owner to renew it.", retryable: false } },
      { n: "No token", fail: 0, code: "401", body: { error: "AUTHENTICATION_FAILED", message: "A valid connector token is required.", retryable: false } },
      { n: "Same write twice", fail: -2, code: "200", body: { status: "COMPLETED", operation: "add_issue_comment", idempotentReplay: true, note: "The stored result of the first run. Nothing was sent to GitHub again." } }
    ];
    root.innerHTML = '<div class="mma-btns reqs" role="group" aria-label="Example requests"></div><div class="gates"></div><div class="resp"><div class="big">·</div><pre>Choose a request above.</pre></div>' +
      '<p class="mma-cap">Responses are shortened, and the repository and URL are examples. The limit, traversal and expiry messages follow the live run. Error bodies always carry <code>retryable</code> and <code>nextStep</code>.</p>';
    var gEl = q(root, ".gates"), rEl = q(root, ".reqs"), busy = null;
    G.forEach(function (g) { var d = document.createElement("div"); d.className = "gate"; d.innerHTML = "<i>" + g[0] + "</i><b>" + g[1] + "</b><i>" + g[2] + "</i>"; gEl.appendChild(d); });
    var gates = qa(gEl, ".gate");
    R.forEach(function (r, i) { var b = document.createElement("button"); b.textContent = r.n; b.addEventListener("click", function () { run(i); }); rEl.appendChild(b); });
    function run(i) {
      if (busy) clearInterval(busy);
      qa(rEl, "button").forEach(function (b, j) { b.classList.toggle("sel", j === i); });
      var r = R[i], k = 0, done = false, codeEl = q(root, ".big"), bodyEl = q(root, ".resp pre");
      gates.forEach(function (g) { g.className = "gate"; });
      codeEl.textContent = "…"; codeEl.style.color = "var(--mut)"; bodyEl.textContent = "sending …";
      function finish() { done = true; if (busy) { clearInterval(busy); busy = null; } codeEl.textContent = r.code; codeEl.style.color = r.code === "200" ? "var(--ok)" : "var(--bad)"; bodyEl.textContent = JSON.stringify(r.body, null, 2); }
      function step() {
        gates.forEach(function (g) { g.classList.remove("act"); });
        if (k >= gates.length) { finish(); return; }
        var g = gates[k];
        if (r.fail >= 0 && k === r.fail) {
          g.classList.add("fail");
          for (var j = k + 1; j < gates.length - 1; j++) gates[j].classList.add("skip");
          gates[gates.length - 1].classList.add(r.fail > 0 ? "pass" : "skip");
          finish(); return;
        }
        if (r.fail === -2 && k === 3) { g.classList.add("pass"); gates[4].classList.add("skip"); gates[5].classList.add("skip"); gates[6].classList.add("pass"); finish(); return; }
        g.classList.add("pass", "act"); k++;
      }
      if (RM) { for (var guard = 0; guard < 10 && !done; guard++) step(); return; }
      step(); busy = setInterval(step, 380);
    }
    run(0);
  };

  /* ---------------- write state machine ---------------- */
  W.writes = function (root) {
    root.classList.add("sm");
    root.innerHTML = '<div class="mma-h"><b>One write, five ways it can go</b><div class="mma-btns"><button class="pri" data-w="ok">Write succeeds</button><button data-w="pre">Fails before sending</button><button data-w="lost">Response lost after sending</button><button data-w="retry">Muse retries</button><button data-w="rec">Owner runs reconcile</button></div></div>' +
      '<div class="scrollx"><svg viewBox="0 0 900 250" role="img" aria-label="Write state machine"></svg></div><pre style="margin-top:.8rem">Press a button to run a write.</pre>';
    var svg = q(root, "svg"), out = q(root, "pre");
    var N = { PENDING: [60, 105], RUNNING: [260, 105], COMPLETED: [500, 40], FAILED: [500, 125], UNKNOWN: [500, 205], RECONCILE: [760, 205] };
    var cls = { COMPLETED: "ok", FAILED: "bad", UNKNOWN: "unk" };
    var mid = "mma-ar-" + Math.random().toString(36).slice(2, 7);
    var m = sv("marker", { id: mid, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, sv("defs", {}, svg));
    sv("path", { d: "M0 0 L10 5 L0 10 z", fill: "var(--mut)" }, m);
    function edge(a, b, label) {
      var p = N[a], r = N[b], x1 = p[0] + 65, y1 = p[1], x2 = r[0] - 65, y2 = r[1], mx = (x1 + x2) / 2;
      sv("path", { d: "M" + x1 + " " + y1 + " C " + mx + " " + y1 + ", " + mx + " " + y2 + ", " + x2 + " " + y2, "class": "ed", "marker-end": "url(#" + mid + ")" }, svg);
      sv("text", { x: mx, y: (y1 + y2) / 2 - 6, "text-anchor": "middle", "class": "edl" }, svg).textContent = label;
    }
    edge("PENDING", "RUNNING", "recorded first"); edge("RUNNING", "COMPLETED", "answer checked"); edge("RUNNING", "FAILED", "not sent · 503"); edge("RUNNING", "UNKNOWN", "sent, answer lost"); edge("UNKNOWN", "RECONCILE", "owner checks GitHub");
    var nodes = {};
    Object.keys(N).forEach(function (k) {
      var g = sv("g", { "class": "st " + (cls[k] || "") }, svg);
      sv("rect", { x: N[k][0] - 65, y: N[k][1] - 20, width: 130, height: 40, rx: 9 }, g);
      sv("text", { x: N[k][0], y: N[k][1] + 4, "text-anchor": "middle" }, g).textContent = k === "RECONCILE" ? "reconcile" : k;
      nodes[k] = g;
    });
    var state = null, tm = [];
    function on(k) { Object.keys(nodes).forEach(function (n) { nodes[n].classList.toggle("on", n === k); }); }
    function seq(list, done) { tm.forEach(clearTimeout); tm = []; list.forEach(function (k, i) { tm.push(setTimeout(function () { on(k); }, RM ? 0 : i * 520)); }); tm.push(setTimeout(done, RM ? 0 : list.length * 520)); }
    function say(s) { out.textContent = s; }
    qa(root, "[data-w]").forEach(function (b) {
      b.addEventListener("click", function () {
        var w = b.dataset.w;
        if (w === "ok") seq(["PENDING", "RUNNING", "COMPLETED"], function () { state = "COMPLETED"; say("200  COMPLETED\nadd_issue_comment ran once. The result is stored under its Idempotency-Key."); });
        if (w === "pre") seq(["PENDING", "RUNNING", "FAILED"], function () { state = "FAILED"; say("503  The MCP server could not be reached, so nothing was sent.\nretryable: true, with a Retry-After header"); });
        if (w === "lost") seq(["PENDING", "RUNNING", "UNKNOWN"], function () { state = "UNKNOWN"; say("DOWNSTREAM_OUTCOME_UNKNOWN\nThe request reached GitHub, but no answer came back.\nThe write is now UNKNOWN. A blind retry could comment twice."); });
        if (w === "retry") {
          if (state === "UNKNOWN") { on("UNKNOWN"); say("409  UNKNOWN_OUTCOME\nretryable: false\nnextStep: the owner checks GitHub, then runs reconcile."); }
          else if (state === "COMPLETED") { on("COMPLETED"); say("200  idempotentReplay: true\nThe stored result is returned. Nothing was sent to GitHub again."); }
          else if (state === "FAILED") seq(["PENDING", "RUNNING", "COMPLETED"], function () { state = "COMPLETED"; say("200  COMPLETED\nSafe to repeat, because nothing had been sent the first time."); });
          else say("Run a write first.");
        }
        if (w === "rec") {
          if (state !== "UNKNOWN") { say("reconcile is only needed for an UNKNOWN write."); return; }
          seq(["RECONCILE", "COMPLETED"], function () { state = "COMPLETED"; say("$ muse-mcp-adapter reconcile --operation-id op_... --outcome completed\nThe owner found the comment on GitHub. The write is settled; a retry now replays it."); });
        }
      });
    });
  };

  /* ---------------- audit hash chain ---------------- */
  W.chain = function (root) {
    var BASE = [["setup.proposal.opened", "chat-setup:agent", "05:38:32"], ["server.discover", "owner", "05:39:44"], ["setup.proposal.compiled", "owner", "05:39:44"], ["setup.proposal.approved", "owner", "05:41:16"], ["catalog.publish", "owner", "05:41:16"], ["catalog.activate", "owner", "05:41:16"], ["setup.proposal.applied", "owner", "05:41:16"]];
    root.innerHTML = '<div class="mma-h"><b>Administrative audit, one widening</b><div class="mma-btns"><button data-c="edit">Edit row 3</button><button data-c="del">Delete row 4</button><button class="pri" data-c="verify">Run audit-verify</button><button data-c="reset">Reset</button></div></div>' +
      '<div class="chain"></div><pre style="margin-top:.8rem">$ audit-verify</pre><p class="mma-cap">Example events for a policy widening. These short hashes illustrate the links; the actual administrative chain uses cryptographic hashes. A saved head hash outside the machine helps verify later changes.</p>';
    function h(s) { var x = 0x811c9dc5; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return ("0000000" + x.toString(16)).slice(-8); }
    var rows, out = q(root, "pre");
    function build() { var prev = "00000000"; rows = BASE.map(function (r) { var o = { ev: r[0], actor: r[1], t: r[2], prev: prev, edited: false }; o.hash = h(prev + o.ev + o.actor + o.t); prev = o.hash; return o; }); }
    function render(bad) {
      q(root, ".chain").innerHTML = rows.map(function (r, i) {
        return '<div class="blk' + (r.edited ? " edited" : "") + (bad && bad.indexOf(i) >= 0 ? " bad" : "") + '"><span class="i">' + (i + 1) + '</span><span class="ev"><b>' + esc(r.ev) + '</b><br>' + esc(r.actor) + " · " + r.t + "Z · prev " + r.prev + '</span><span class="h">' + r.hash + "</span></div>";
      }).join("");
    }
    function verify() {
      var prev = "00000000", bad = [];
      rows.forEach(function (r, i) { if (r.prev !== prev || h(r.prev + r.ev + r.actor + r.t) !== r.hash) bad.push(i); prev = r.hash; });
      render(bad);
      out.textContent = "$ audit-verify\n" + (bad.length ? "BROKEN at row " + (bad[0] + 1) + ": its hash does not match its contents, or it does not point at the row before it.\nexit 1" : "chain OK · " + rows.length + " rows · head " + rows[rows.length - 1].hash);
    }
    qa(root, "[data-c]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = b.dataset.c;
        if (c === "edit") { var r = rows[2]; if (!r || r.edited) return; r.ev = "setup.proposal.compiled (merge added)"; r.edited = true; render(); out.textContent = "$ # row 3 was changed in the database. Run audit-verify."; }
        if (c === "del") { if (rows.length < 5) return; rows.splice(3, 1); render(); out.textContent = "$ # row 4 (the approval) was deleted. Run audit-verify."; }
        if (c === "verify") verify();
        if (c === "reset") { build(); render(); out.textContent = "$ audit-verify"; }
      });
    });
    build(); render();
  };

  /* ---------------- the afternoon replay ---------------- */
  W.replay = function (root) {
    var B = [
      {
            "t": "Ask in plain words",
            "time": "Step 1 · a proposal grants nothing",
            "you": "Connect GitHub so you can read issues and pull requests in OWNER/REPO for one hour. No commenting, merging or deleting.",
            "muse": "Here is a review link. Open it in your own browser. Do not paste your service token into the chat.",
            "ad": "find_server\npropose_connection → proposal opened",
            "gt": "Nothing is available through the new connection yet."
      },
      {
            "t": "Review and approve",
            "time": "Step 2 · owner review",
            "you": "On my adapter’s page: owner password → GitHub token → review operations, owner/repo limits and expiry → password → Approve.",
            "muse": "Reads the recorded capabilities, drafts the policy, then checks its status. After approval, shows the Connect card.",
            "ad": "get_service_details\nrevise_proposal\nsetup.proposal.approved (owner)\ncatalog.activate\nsetup.proposal.applied",
            "gt": "The selected read operations become available after you complete the connection in Muse."
      },
      {
            "t": "A write that isn't allowed",
            "time": "Step 3 · commenting remains unavailable",
            "you": "Comment on issue 3 saying we are looking into it.",
            "muse": "The published connector has no comment operation. A permission change is needed before commenting through this connection.",
            "ad": "explain_connection\nadd_issue_comment is not published\na direct call to that operation → 404",
            "gt": "No comment is created through this connection."
      },
      {
            "t": "Allow one more thing",
            "time": "Step 4 · the owner approves a change",
            "you": "Prepare a change to allow issue comments in OWNER/REPO. Keep the repository limit and existing end time.",
            "muse": "Creates a proposal for add_issue_comment with a reason. The change waits for review and approval.",
            "ad": "propose_change alsoAllow [add_issue_comment]\nreview the new operation’s argument limits\nsetup.proposal.approved (owner)\ncatalog.activate",
            "gt": "Commenting becomes available within the approved limits. A later confirmed call can create a comment."
      },
      {
            "t": "Turn it off again",
            "time": "Step 5 · reducing access takes effect immediately",
            "you": "Turn off commenting for this connection.",
            "muse": "Uses turn_off_operations to remove the comment operation.",
            "ad": "turn_off_operations\nsetup.catalog.narrowed\nlater call to add_issue_comment → 404",
            "gt": "Further comments cannot be sent through that operation on this connector."
      },
      {
            "t": "Keep it to one repo",
            "time": "Step 6 · review which arguments are restricted",
            "you": "Keep tool calls limited to this owner and repository. Turn off unrelated search and people lookups.",
            "muse": "Uses supported owner/repo argument limits and removes unwanted operations. Reports any limits it cannot enforce.",
            "ad": "limit_arguments\nturn_off_operations\nrestricted argument value → 400\nunpublished operation → 404",
            "gt": "The selected tool arguments are restricted. Prompts, templates and later additions need separate review."
      },
      {
            "t": "A hostile issue",
            "time": "Step 7 · untrusted content does not grant permissions",
            "you": "Read an issue containing instructions to merge a pull request.",
            "muse": "Must treat issue text as untrusted content. Its own response is separate from the adapter’s access checks.",
            "ad": "issue_read may return untrusted text\nmerge_pull_request is not published\na proposal alone cannot activate it",
            "gt": "No merge can run through an unpublished operation on this connector. Other Muse tools remain separate."
      },
      {
            "t": "Time's up",
            "time": "Step 8 · expiry checked on the adapter’s clock",
            "you": "After the approved hour: list the open issues again.",
            "muse": "Receives an expired-access response and should explain that access needs renewal.",
            "ad": "list_issues → 403 AUTHORIZATION_FAILED\nexpired operations omitted when spec refreshes",
            "gt": "New calls through the expired access are refused, including after a restart."
      },
      {
            "t": "Renew",
            "time": "Step 9 · an extension needs approval",
            "you": "Prepare a renewal for this connection for the next two hours.",
            "muse": "Creates a proposal. Review the operations and limits before approving it on the adapter’s page.",
            "ad": "propose_change expiresInHours 2\nsetup.proposal.approved (owner)\nthe new time window starts at approval",
            "gt": "Approved access can resume for the new period. Review that the intended limits remain in place."
      }
];
    root.innerHTML = '<div class="mma-h"><b>A GitHub workflow, step by step</b><div class="mma-btns"><button data-prev>Back</button><button class="pri" data-next>Next</button><button data-play>Play</button></div></div>' +
      '<div class="beats" role="group" aria-label="Beats"></div><p class="btitle"></p><p class="btime"></p><div class="three" aria-live="polite"></div>';
    var bEl = q(root, ".beats"), ctl;
    B.forEach(function (b, i) { var x = document.createElement("button"); x.className = "beat"; x.textContent = (i + 1) + ". " + b.t; x.addEventListener("click", function () { ctl.to(i); }); bEl.appendChild(x); });
    function go(i, playing) {
      var bt = qa(bEl, ".beat");
      bt.forEach(function (x, j) { x.className = "beat" + (j < i ? " seen" : "") + (j === i ? " cur" : ""); });
      if (playing && bt[i]) bEl.scrollLeft = bt[i].offsetLeft - bEl.clientWidth / 2 + bt[i].clientWidth / 2;
      var b = B[i];
      q(root, ".btitle").textContent = (i + 1) + ". " + b.t; q(root, ".btime").textContent = b.time;
      q(root, ".three").innerHTML = '<div class="c3"><span>In the chat</span><div class="bub">' + esc(b.you) + "</div>" + (b.muse ? '<div class="bub m">' + esc(b.muse) + "</div>" : "") + "</div>" +
        '<div class="c3"><span>Adapter events (condensed)</span><div class="mono">' + esc(b.ad).replace(/\n/g, "<br>") + "</div></div>" +
        '<div class="c3"><span>Expected result</span><div>' + esc(b.gt) + "</div></div>";
    }
    ctl = stepper(root, B.length, go, 4200);
    ctl.to(0);
  };

  /* ---------------- path traversal before/after ---------------- */
  W.traversal = function (root) {
    var P = /^https:\/\/docs\.example\.com\/guides\/azure\/.*$/;
    var PRE = [["Allowed page", "https://docs.example.com/guides/azure/functions/overview"], ["../", "https://docs.example.com/guides/azure/../dotnet/"], ["%2e%2e", "https://docs.example.com/guides/azure/%2e%2e/dotnet/"], ["double encoded", "https://docs.example.com/guides/azure/%252e%252e/dotnet/"], ["backslash", "https://docs.example.com/guides/azure/..\\dotnet/"], ["Outside the prefix", "https://docs.example.com/guides/dotnet/"]];
    root.classList.add("trav");
    root.innerHTML = '<div class="mma-h"><b>Limit: <code>^https://docs\\.example\\.com/guides/azure/.*$</code></b></div>' +
      '<input type="text" spellcheck="false" autocomplete="off" aria-label="Value Muse sends for url" value="https://docs.example.com/guides/azure/../dotnet/"><div class="mma-btns" style="margin-top:.55rem"></div>' +
      '<div class="verd"><div class="vd b"></div><div class="vd a"></div></div>' +
      '<p class="mma-cap">A simplified version of the adapter\'s check, for this page. The real check folds Unicode, removes up to three layers of percent-escapes, and refuses dot segments, backslashes, encoded dots or slashes and control characters in any reading, for every pattern that names a place.</p>';
    var inp = q(root, "input"), pre = q(root, ".mma-btns");
    PRE.forEach(function (p) { var b = document.createElement("button"); b.textContent = p[0]; b.addEventListener("click", function () { inp.value = p[1]; check(); }); pre.appendChild(b); });
    function readings(v) {
      var out = [v], c = v; try { out.push(v.normalize("NFKC")); } catch (e) { }
      for (var i = 0; i < 3; i++) { var d; try { d = decodeURIComponent(c); } catch (e) { break; } if (d === c) break; out.push(d); try { out.push(d.normalize("NFKC")); } catch (e) { } c = d; }
      return out;
    }
    function carries(v) {
      var rs = readings(v);
      for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        if (/[\x00-\x1f\x7f]/.test(r)) return "a control character";
        if (/\\/.test(r)) return "a backslash";
        if (/%2e|%2f|%5c/i.test(r)) return "an encoded dot or slash";
        var seg = r.split(/[?#]/)[0].split("/");
        for (var j = 0; j < seg.length; j++) if (seg[j] === "." || seg[j] === "..") return "a " + seg[j] + " segment";
      }
      return null;
    }
    function check() {
      var v = inp.value, m = P.test(v), c = m ? carries(v) : null, ok = m && !c;
      var vb = q(root, ".vd.b"), va = q(root, ".vd.a");
      vb.className = "vd b " + (m ? "ok" : "bad");
      vb.innerHTML = "A plain pattern match<strong>" + (m ? "200 · forwarded" : "400 · refused") + "</strong>" + (m ? "The pattern matched the text as written." : "The value does not match the pattern.");
      va.className = "vd a " + (ok ? "ok" : "bad");
      va.innerHTML = "The adapter's check<strong>" + (ok ? "200 · forwarded" : "400 · refused") + "</strong>" + (!m ? "The value does not match the pattern." : c ? "It carries " + c + ", which the service could read as another place." : "Matches, and no reading of it names another place.");
    }
    inp.addEventListener("input", check); check();
  };

  /* ---------------- today: one connector per server, and what can go wrong ---------------- */
  W.today = function (root) {
    root.innerHTML = '<div class="mma-h"><b>Example connections: explore the controls</b><div class="mma-btns"><button class="pri" data-playall>Play all</button></div></div>' +
      '<div class="mma-btns issues" role="group" aria-label="Problems"></div>' +
      '<svg viewBox="0 0 760 300" role="img" aria-label="Muse connected directly to three MCP servers, one connector each"><g class="b"></g><g class="o"></g></svg>' +
      '<div class="tlabel">Tools the agent can call through the GitHub connector</div><div class="tools chips"></div><div class="info" aria-live="polite"></div>';
    var svg = q(root, "svg"), base = q(root, "g.b"), ov = q(root, "g.o"), chipsEl = q(root, ".chips"), info = q(root, ".info");
    var F = "Inter, system-ui, sans-serif", MONO = "JetBrains Mono, monospace";
    var MU = [140, 160], SV = [[600, 55, "GitHub"], [600, 150, "Linear"], [600, 245, "Your server"]];
    var boxes = {};
    function rect(x, y, w, h, parent) { return sv("rect", { x: x, y: y, width: w, height: h, rx: 11, fill: "var(--card2)", stroke: "var(--line)", "stroke-width": 1.5 }, parent || base); }
    function txt(x, y, s, size, opt, parent) { opt = opt || {}; var t = sv("text", { x: x, y: y, "text-anchor": opt.anchor || "middle", fill: opt.fill || "var(--ink)", "font-family": opt.mono ? MONO : F, "font-weight": opt.bold ? 600 : 400, "font-size": size }, parent || base); t.textContent = s; return t; }
    SV.forEach(function (s) { sv("line", { x1: MU[0], y1: MU[1], x2: s[0], y2: s[1], stroke: "var(--line)", "stroke-width": 2 }, base); });
    SV.forEach(function (s) {
      var px = MU[0] + 0.38 * (s[0] - MU[0]), py = MU[1] + 0.38 * (s[1] - MU[1]);
      sv("rect", { x: px - 40, y: py - 10, width: 80, height: 20, rx: 10, fill: "var(--card)", stroke: "var(--line)" }, base);
      txt(px, py + 4, "connector", 11, { fill: "var(--mut)" });
    });
    boxes.muse = rect(20, 125, 120, 70); txt(80, 156, "Muse", 16, { bold: 1 }); txt(80, 177, "your agent", 12, { fill: "var(--mut)" });
    SV.forEach(function (s, i) { boxes[i] = rect(600, s[1] - 27, 140, 54); txt(670, s[1] - 3, s[2], 14, { bold: 1 }); txt(670, s[1] + 15, "MCP server", 11.5, { fill: "var(--mut)" }); });
    var CHIPS = [["list_issues", "read"], ["issue_read", "read"], ["list_pull_requests", "read"], ["search_code", "read"], ["add_issue_comment", "write"], ["create_pull_request", "write"], ["merge_pull_request", "write"], ["delete_file", "write"]];
    var gen = 0, timers = [];
    function later(ms, fn) { var my = gen; timers.push(setTimeout(function () { if (my === gen) fn(); }, RM ? 0 : ms)); }
    function reset() {
      gen++; timers.forEach(clearTimeout); timers = []; ov.innerHTML = "";
      boxes.muse.setAttribute("stroke", "var(--line)"); SV.forEach(function (s, i) { boxes[i].setAttribute("stroke", "var(--line)"); });
      chipsEl.innerHTML = CHIPS.map(function (c) { return '<span class="tool ' + c[1] + '">' + c[0] + '</span>'; }).join("");
    }
    function tag(x, y, s, color) {
      var g = sv("g", { "class": "tag" }, ov), t = txt(x, y + 4, s, 11.5, { mono: 1, fill: color }, g);
      var w = t.getComputedTextLength ? t.getComputedTextLength() : s.length * 7;
      var r = sv("rect", { x: x - w / 2 - 7, y: y - 10, width: w + 14, height: 20, rx: 10, fill: "var(--card)", stroke: color }, g);
      g.insertBefore(r, t); return g;
    }
    function move(from, to, label, color, ms, cb) {
      var my = gen, c = sv("circle", { r: 7, fill: color, cx: from[0], cy: from[1] }, ov), lab = txt(from[0], from[1] - 12, label, 11, { mono: 1, fill: color }, ov);
      var w = lab.getComputedTextLength ? lab.getComputedTextLength() : label.length * 6.6, t0 = performance.now(), dur = RM ? 1 : ms;
      function f(now) {
        if (my !== gen) { c.remove(); lab.remove(); return; }
        var k = Math.min((now - t0) / dur, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e;
        c.setAttribute("cx", x); c.setAttribute("cy", y);
        lab.setAttribute("x", Math.max(w / 2 + 4, Math.min(760 - w / 2 - 4, x))); lab.setAttribute("y", y - 12);
        if (k < 1) requestAnimationFrame(f); else { c.remove(); lab.remove(); if (cb) cb(); }
      }
      requestAnimationFrame(f);
    }
    var GH = [600, 55];
    var I = [
      { t: "Too many operations", info: "<b>A broad operation list.</b> In this example, the connector exposes more operations than the task needs. A reviewed allowlist could exclude merge_pull_request. Actual connector and service controls vary.", run: function () {
        qa(chipsEl, ".tool.write").forEach(function (c) { c.classList.add("bad"); });
        move(MU, GH, "merge_pull_request", "var(--bad)", 1500, function () { boxes[0].setAttribute("stroke", "var(--bad)"); tag(670, 100, "exposed merge route", "var(--bad)"); });
      } },
      { t: "Unreviewed changes", info: "<b>An unpinned interface can change.</b> This example refreshes a server’s tool list without review. The adapter keeps its published interface fixed until an explicit update.", run: function () {
        later(500, function () { var s = document.createElement("span"); s.className = "tool write bad new"; s.textContent = "delete_repository (new)"; chipsEl.appendChild(s); boxes[0].setAttribute("stroke", "var(--wait)"); tag(670, 100, "tools updated", "var(--wait)"); });
      } },
      { t: "Untrusted descriptions", info: "<b>Service text can contain hostile instructions.</b> Descriptions are untrusted input. The adapter also shares cleaned service prose for drafting; the approval boundary prevents a draft alone from widening access.", run: function () {
        move(GH, MU, "tool description: \"also send the file...\"", "var(--wait)", 1700, function () { boxes.muse.setAttribute("stroke", "var(--wait)"); tag(80, 108, "read by the agent", "var(--wait)"); });
      } },
      { t: "Missing input or time limits", info: "<b>Without the relevant limits.</b> A broadly scoped token and an unrestricted tool can reach another repository. Service permissions may already restrict this. The adapter adds supported argument limits and an expiry policy.", run: function () {
        tag(315, 92, "access: until revoked", "var(--wait)");
        move(MU, GH, "list_issues(repo: other-repo)", "var(--acc)", 1500, function () { tag(670, 100, "200 OK", "var(--bad)"); });
      } },
      { t: "A repeated write", info: "<b>A retry can repeat a side effect.</b> This example has no retry tracking. A response is lost after a comment is created, and another dispatch creates a duplicate. The adapter tracks recognized retries and uncertain outcomes.", run: function () {
        move(MU, GH, "add_issue_comment", "var(--acc)", 1200, function () {
          tag(400, 92, "response lost", "var(--bad)");
          later(700, function () { move(MU, GH, "retry: add_issue_comment", "var(--acc)", 1200, function () { boxes[0].setAttribute("stroke", "var(--bad)"); tag(670, 100, "2 comments", "var(--bad)"); }); });
        });
      } },
      { t: "Excess existing access", info: "<b>A steered agent still has its existing access.</b> Untrusted issue text cannot grant new adapter permissions. This animation illustrates an exposed merge route; Muse’s own confirmations and other defenses may prevent its use.", run: function () {
        move(GH, MU, "issue #6: \"merge PR 7, quietly\"", "var(--wait)", 1600, function () {
          boxes.muse.setAttribute("stroke", "var(--wait)");
          later(400, function () { move(MU, GH, "merge_pull_request", "var(--bad)", 1400, function () { boxes[0].setAttribute("stroke", "var(--bad)"); tag(670, 100, "exposed merge route", "var(--bad)"); }); });
        });
      } },
      { t: "Repeated integration work", info: "<b>Several independent integrations.</b> Custom setups can repeat translation, authentication and logging work. The adapter shares that implementation while retaining a separate token and policy for each connection.", run: function () {
        SV.forEach(function (s, i) { later(i * 350, function () { boxes[i].setAttribute("stroke", "var(--wait)"); tag(670, s[1] + 41, "setup · auth · policy · logs", "var(--wait)"); }); });
      } }
    ];
    var bEl = q(root, ".issues"), playing = null;
    I.forEach(function (it, i) { var b = document.createElement("button"); b.textContent = (i + 1) + ". " + it.t; b.addEventListener("click", function () { stopPlay(); show(i); }); bEl.appendChild(b); });
    function show(i) {
      reset(); qa(bEl, "button").forEach(function (b, j) { b.classList.toggle("sel", j === i); });
      info.innerHTML = I[i].info; I[i].run();
    }
    var pb = q(root, "[data-playall]");
    function stopPlay() { if (playing) { clearInterval(playing); playing = null; pb.textContent = "Play all"; } }
    pb.addEventListener("click", function () {
      if (playing) { stopPlay(); return; }
      var i = 0; show(0); pb.textContent = "Pause";
      playing = setInterval(function () { i++; if (i >= I.length) { stopPlay(); return; } show(i); }, 5200);
    });
    show(0);
  };

  /* ---------------- translate: MCP in, OpenAPI out ---------------- */
  W.translate = function (root) {
    var T = [
      { t: "A tool that writes", mcp: [
        '{',
        '  "name": "add_issue_comment",',
        '  "description": "Add a comment to an issue",',
        '  "inputSchema": {',
        '    "type": "object",',
        '    "properties": {',
        '      "owner": { "type": "string" },',
        '      "repo": { "type": "string" },',
        '      "issue_number": { "type": "number" },',
        '      "body": { "type": "string" }',
        '    },',
        '    "required": ["owner", "repo", "issue_number", "body"]',
        '  }',
        '}'], api: [
        '/c/<slug>/operations/add_issue_comment:',
        '  post:',
        '    operationId: add_issue_comment',
        '    description: >-',
        '      Add a comment to an issue. (pinned at publish;',
        '      notes that it changes data and any owner limits)',
        '    x-muse-classification: write',
        '    x-requires-confirmation: true',
        '    parameters:',
        '      - { name: Idempotency-Key, in: header }',
        '    requestBody:',
        '      content:',
        '        application/json:',
        '          schema: <the tool\'s input schema>',
        '    responses: [200, 400, 401, 403, 404, 409, 502, 503]'], add: [
        "The classification comes from your policy, not the server's annotations.",
        "Writes are marked for confirmation, so Muse asks you before calling them.",
        "An <code>Idempotency-Key</code> header makes a retry replay instead of re-run.",
        "The description is pinned when you publish, so the server can't change it later.",
        "A fixed set of responses, and every error carries <code>retryable</code> and <code>nextStep</code>."] },
      { t: "A tool that reads", mcp: [
        '{',
        '  "name": "list_issues",',
        '  "description": "List issues in a repository",',
        '  "annotations": { "readOnlyHint": true },',
        '  "inputSchema": {',
        '    "type": "object",',
        '    "properties": {',
        '      "owner": { "type": "string" },',
        '      "repo": { "type": "string" },',
        '      "state": { "type": "string" }',
        '    },',
        '    "required": ["owner", "repo"]',
        '  }',
        '}'], api: [
        '/c/<slug>/operations/list_issues:',
        '  post:',
        '    operationId: list_issues',
        '    description: >-',
        '      List issues in a repository. Read-only: retrieves',
        '      information and does not change anything.',
        '    x-muse-classification: read',
        '    requestBody:',
        '      content:',
        '        application/json:',
        '          schema: <the tool\'s input schema>',
        '    responses: [200, 400, 401, 403, 404, 409, 502, 503]'], add: [
        "<code>readOnlyHint</code> is evidence. Your policy is what makes it a read.",
        "Reads need no confirmation and no idempotency key.",
        "Owner limits, such as one repository, are written into the description and enforced on every call."] },
      { t: "A resource template", mcp: [
        '{',
        '  "uriTemplate": "issues://{project}/{id}",',
        '  "name": "issue",',
        '  "mimeType": "application/json"',
        '}'], api: [
        '/c/<slug>/operations/issue:',
        '  post:',
        '    operationId: issue',
        '    x-muse-classification: read',
        '    requestBody:',
        '      content:',
        '        application/json:',
        '          schema:',
        '            required: [project, id]',
        '            properties:',
        '              project: { type: string }',
        '              id: { type: string }'], add: [
        "Each template variable becomes a required field.",
        "The adapter builds the URI itself and encodes each value, so Muse never sends a raw address.",
        "Values can be limited by pattern, and schemes such as <code>file:</code> and <code>data:</code> are refused."] },
      { t: "A prompt", mcp: [
        '{',
        '  "name": "summarize_issue",',
        '  "arguments": [',
        '    { "name": "issue_number", "required": true }',
        '  ]',
        '}'], api: [
        '/c/<slug>/operations/summarize_issue:',
        '  post:',
        '    operationId: summarize_issue',
        '    x-muse-classification: read',
        '    requestBody:',
        '      content:',
        '        application/json:',
        '          schema:',
        '            required: [issue_number]',
        '    # returns the prompt\'s messages, roles kept'], add: [
        "A prompt becomes a read operation that returns its messages.",
        "Roles and where each message came from are kept.",
        "Fetching a prompt never authorizes the tool calls it mentions."] }
    ];
    root.innerHTML = '<div class="mma-h"><b>MCP in, OpenAPI out</b><div class="mma-btns tabs"></div></div>' +
      '<div class="xl"><div><span class="lab">What the MCP server publishes</span><pre class="l"></pre></div><div class="arrow" aria-hidden="true">→</div><div><span class="lab">What Muse reads (generated)</span><pre class="r"></pre></div></div>' +
      '<div class="info"><b>What the adapter adds</b><ul class="adds"></ul></div>' +
      '<p class="mma-cap">Shortened for reading. The extension names (<code>x-muse-classification</code>, <code>x-requires-confirmation</code>) and the <code>Idempotency-Key</code> header are the ones the adapter generates; the description wording is paraphrased.</p>';
    var tabs = q(root, ".tabs"), L = q(root, "pre.l"), R = q(root, "pre.r"), A = q(root, ".adds"), arrow = q(root, ".arrow"), timer = null;
    T.forEach(function (x, i) { var b = document.createElement("button"); b.textContent = x.t; b.addEventListener("click", function () { go(i); }); tabs.appendChild(b); });
    function go(i) {
      if (timer) clearInterval(timer);
      qa(tabs, "button").forEach(function (b, j) { b.classList.toggle("sel", j === i); });
      var x = T[i]; L.textContent = x.mcp.join("\n"); R.textContent = ""; A.innerHTML = "";
      arrow.classList.remove("go"); void arrow.offsetWidth; arrow.classList.add("go");
      var n = 0;
      function step() {
        if (n >= x.api.length) { clearInterval(timer); timer = null; A.innerHTML = x.add.map(function (a) { return "<li>" + a + "</li>"; }).join(""); return; }
        R.textContent += (n ? "\n" : "") + x.api[n]; n++;
      }
      if (RM) { while (n < x.api.length) step(); step(); return; }
      timer = setInterval(step, 90);
    }
    go(0);
  };

  function boot() {
    qa(document, ".mma[data-widget]").forEach(function (el) {
      var f = W[el.getAttribute("data-widget")];
      if (!f) return;
      try { f(el); } catch (e) { if (window.console) console.error("figure " + el.getAttribute("data-widget") + " failed", e); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
