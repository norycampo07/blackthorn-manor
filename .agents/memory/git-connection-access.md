---
name: Git connection access
description: Workspace-specific mismatch between connected GitHub status and executable access
---

Do not treat a healthy, attached GitHub connection as proof that repository operations can execute in this workspace.

**Why:** The connection reported healthy and already attached, while the GitHub CLI required authentication and the sandbox exposed no matching API connection.

**How to apply:** Verify authenticated access before creating repositories or reporting a push. Use managed authorization recovery when needed; never inspect or copy credentials to work around the mismatch.
