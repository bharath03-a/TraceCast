# Vision

TraceCast exists to make software demos repeatable.

Teams already automate builds, tests, deployments, and screenshots, but demos are still often created by manually opening a screen recorder and hoping the walkthrough goes well. That makes demos slow to create, easy to break, hard to review, and painful to regenerate after product changes.

TraceCast treats a demo as code: a workflow that can be written, reviewed, versioned, executed, recorded, and regenerated.

## Problem

Software teams ship faster than they can explain what they shipped.

Common outputs such as README GIFs, launch videos, release note demos, PR walkthroughs, bug reproduction videos, onboarding clips, conference demos, and support tutorials require repeated manual recording.

Manual demo recording has several problems:

- recordings drift out of date
- small mistakes force full re-recording
- demos are hard to reproduce
- browser, terminal, and app workflows are split across tools
- agents can perform work, but do not produce polished demo artifacts reliably

## Product Thesis

A demo should be a reproducible workflow plus a video artifact.

TraceCast should let humans write workflows and let coding assistants generate or repair workflows, while the runtime safely executes actions and records what happened.

## Positioning

Demo-as-code for software teams.

TraceCast is not only a screen recorder. It is the orchestration layer between scripts, agents, terminal sessions, browsers, desktop apps, event logs, and video export.

## Guiding Principle

Script-first, agent-compatible, runtime-controlled.

The script gives reliability. Agents provide adaptability. The runtime provides safety, logging, and reproducibility.
