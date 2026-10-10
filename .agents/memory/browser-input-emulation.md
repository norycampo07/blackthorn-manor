---
name: Browser input emulation
description: Desktop hover checks may be blocked by the testing browser's input capabilities
---
The testing browser has reported `hover: none` and no fine pointer even with a desktop viewport and touch disabled. Chromium media emulation accepted hover/pointer overrides without changing those reported capabilities.

**Why:** This prevented a mouse-only map zoom rule from activating in automated verification; it is a test-environment limitation, not evidence that desktop hover is broken.

**How to apply:** Check input media capabilities before interpreting hover-test failures. Do not remove touch safeguards merely to accommodate the harness. Report any unverified hover behavior explicitly.
