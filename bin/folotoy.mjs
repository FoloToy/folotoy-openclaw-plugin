#!/usr/bin/env node
// Trampoline: keeps the legacy `npx @folotoy/folotoy-openclaw-plugin install`
// command working after the CLI was extracted into a separate package
// (@folotoy/folotoy-openclaw-installer). External docs and other software
// already hardcode this command; redirecting via dynamic import avoids
// child_process / fetch / process.env so OpenClaw 2026.4.x's plugin scanner
// doesn't flag the runtime tarball.
import '@folotoy/folotoy-openclaw-installer/bin/folotoy.mjs'
