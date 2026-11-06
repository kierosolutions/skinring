# SkinRing

**SkinRing is a prototype of [ASI](https://asi.org) to enable accessible skin cancer detection.**

> ⚠️ **Not certified.** SkinRing is a research prototype. It is **not** a medical device and is not certified or approved by any authority (no CE / EU MDR, FDA or Swissmedic clearance). It does not diagnose anything and must not be used to make medical decisions. If a mole or spot worries you — or changes in size, shape or colour — see a dermatologist.

## What it does

SkinRing is a mobile web app (PWA) for documenting skin lesions over time:

- **Camera capture with the SkinRing spacer** – a ring placed on the skin keeps the same distance on every photo; the app turns on the phone's flashlight for similar lighting (it asks for camera access). The 3D-printable gadget (50 mm ring, 80 mm lens-to-skin, universal phone cradle) is in [`hardware/`](hardware/).
- **Measurement from the ring** – the ring is detected in the photo and used as a scale (mm per pixel); the lesion is outlined and its diameter and area are measured.
- **Body map and history** – lesions are placed on a body map and photographed again at intervals, so changes can be compared side by side.
- **Checklists** – ABCDE rule, 7-point checklist and the "ugly duckling" comparison as structured aids.
- **Optional AI triage** – a Claude (Anthropic, Claude Opus 5.5) analysis via the server (only when an API key is configured).
- **Local and encrypted** – data is stored on the device; PDF export for a doctor's visit.

## Status

Early prototype, generated with Google AI Studio and under active review. Known open points: removing any placeholder/fallback values, improving lesion segmentation and border metrics, and replacing the demo user and sample data.

## Run locally

Prerequisites: Node.js

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` (only needed for the AI triage)
3. Start: `npm run dev`
