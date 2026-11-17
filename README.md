# Engineering Notes

Technical deep-dives on distributed systems, database internals, and backend architecture — lessons from building production systems at scale.

## Posts

1. [The Partition Key That Broke Production](https://kishore712.github.io/technical-blogs/blog/the-partition-key-that-broke-production/)
2. [Concurrency in Databases](https://kishore712.github.io/technical-blogs/blog/concurrency-in-databases/)
3. [Sharing Infrastructure Without Sharing Data](https://kishore712.github.io/technical-blogs/blog/sharing-infrastructure-without-sharing-data/)
4. [Muse MCP Adapter: Connect Your Tools, Control the Access](https://kishore712.github.io/technical-blogs/blog/the-agent-writes-the-policy-you-grant-it/)

## Publishing

The Pages workflow uses GitHub's official Jekyll builder, which includes the Ruby,
Jekyll and supported plugin versions for GitHub Pages. The site URL, project base
path and permalink settings are defined in `_config.yml`.

Pull requests targeting `main` run the same production build and upload its output
for review. Deployment runs only on `main`, after a successful build, for a push or
manual workflow run. Pull-request builds have read-only repository access; Pages
publication permissions are limited to the deployment job.

---

Built with [Jekyll](https://jekyllrb.com/) and hosted on [GitHub Pages](https://pages.github.com/).
