---
name: Large file downloads
description: Size limit and fallback delivery for large project exports
---

Asset download cards have a 100 MiB per-file limit. Do not silently omit requested files to fit the limit.

**Why:** A complete project ZIP exceeded the asset-registration limit, but a download served by the running preview successfully exposed the full archive.

**How to apply:** For oversized exports, use a verified preview download when appropriate and explain that it depends on the running preview. Keep generated archives out of source control and do not dereference filesystem links into unrelated mounted content.
