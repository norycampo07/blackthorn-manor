---
name: Test runner access
description: How to distinguish an unavailable pnpm command from an actually missing test runtime.
---

In this workspace, tsx has been installed in the pnpm store without being exposed by pnpm exec at the workspace root or API package.

**Why:** Both command contexts reported that tsx was not found, but invoking the already-installed runner's CLI directly worked without installing dependencies.

**How to apply:** Before adding a test dependency just because pnpm exec fails, inspect the current pnpm store for an existing runner and locate its actual CLI. Do not assume an old package version is still present.
