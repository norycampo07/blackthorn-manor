---
name: Git connection access
description: Workspace-specific mismatch between connected GitHub status and executable access
---

Do not treat a healthy, attached GitHub connection as proof that repository operations can execute in this workspace.

**Why:** The connection reported healthy and already attached, while the GitHub CLI required authentication and the sandbox exposed no matching API connection. A fresh authorization also left the CLI unauthenticated. An HTTPS push to an existing repository reached GitHub but its credentials were rejected even after refreshing the attached connection.

**How to apply:** Verify authenticated access before creating repositories or reporting a push. Do not repeatedly ask for account reconnection when a fresh authorization has already failed to restore CLI access. The documented Git-pane provider authentication is a separate available route; never inspect or copy credentials to work around the mismatch.

An externally completed push can succeed while the Agent's CLI still rejects authentication.

**Why:** After the user reported a successful push, the remote branch and local HEAD matched even though the Agent's push command still failed.

**How to apply:** When the user reports pushing successfully, compare `git ls-remote` with local HEAD before claiming the repository is not uploaded. An Agent CLI authentication failure does not establish a failure of the user's push.
