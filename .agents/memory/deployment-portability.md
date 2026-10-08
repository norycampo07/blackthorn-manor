---
name: Deployment portability
description: Hosting compatibility requirements for Blackthorn Manor
---

Blackthorn Manor must support static builds on Vercel while retaining Replit development functionality.

**Why:** The user requested a Vercel build fix and explicitly required local Replit development to continue without removing development features.

**How to apply:** Do not make production configuration loading depend on environment variables supplied only by the development workflow. Honor supplied development configuration and retain development plugins and server behavior. Verify both an environment-independent frontend build and the managed Replit development workflow when changing hosting configuration.
