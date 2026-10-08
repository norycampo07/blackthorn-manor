---
name: Git connection access
description: Workspace-specific mismatch between connected GitHub status and executable access
---

Do not treat a healthy, attached GitHub connection as proof that repository operations can execute in this workspace.

**Why:** The connection reported healthy and already attached, while the GitHub CLI required authentication and the sandbox exposed no matching API connection. A fresh authorization also left the CLI unauthenticated. An HTTPS push to an existing repository reached GitHub but its credentials were rejected even after refreshing the attached connection.

**How to apply:** Verify authenticated access before creating repositories or reporting a push. Do not repeatedly ask for account reconnection when a fresh authorization has already failed to restore CLI access. The documented Git-pane provider authentication is a separate available route; never inspect or copy credentials to work around the mismatch.
