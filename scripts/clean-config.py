#!/usr/bin/env python3
"""
Clean stale FoloToy plugin config from openclaw.json.

Use before reinstalling the plugin when openclaw reports:
  "channels.folotoy: unknown channel id: folotoy"

Usage:
  python3 scripts/clean-config.py
  python3 scripts/clean-config.py /path/to/openclaw.json
"""
import json
import os
import sys

default_path = os.path.expanduser("~/.openclaw/openclaw.json")
config_path = sys.argv[1] if len(sys.argv) > 1 else default_path

if not os.path.isfile(config_path):
    print(f"Config not found: {config_path}")
    sys.exit(1)

with open(config_path) as f:
    cfg = json.load(f)

changed = False

if cfg.get("channels", {}).pop("folotoy", None) is not None:
    print("Removed channels.folotoy")
    changed = True

if cfg.get("plugins", {}).get("entries", {}).pop("folotoy-openclaw-plugin", None) is not None:
    print("Removed plugins.entries.folotoy-openclaw-plugin")
    changed = True

allow = cfg.get("plugins", {}).get("allow", [])
if "folotoy-openclaw-plugin" in allow:
    allow.remove("folotoy-openclaw-plugin")
    print("Removed folotoy-openclaw-plugin from plugins.allow")
    changed = True

if cfg.get("plugins", {}).get("installs", {}).pop("folotoy-openclaw-plugin", None) is not None:
    print("Removed plugins.installs.folotoy-openclaw-plugin")
    changed = True

if changed:
    with open(config_path, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print(f"Updated {config_path}")
else:
    print("Nothing to clean")
