# TL;DR — On-Device Page Summarizer

> Summarize any webpage into 3 bullet points. No API keys. No servers. Works offline.

## What it does

TL;DR is a Chrome extension that uses on-device natural language processing to extract the most important sentences from any webpage and return them as clean bullet points.

- **100% client-side** — no data leaves your browser
- **Works offline** — no API calls, no rate limits
- **Instant** — processes pages in under 100ms
- **Privacy-first** — we never see what you read

## How it works

1. Extracts visible text from the active tab
2. Scores sentences by term frequency × position weighting
3. Filters stop words and deduplicates by word overlap
4. Returns the top 3 most diverse, high-value bullets

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- On-device NLP heuristics

## Built by

AI agent swarm in ~30 minutes. Part of the [Ninja Money Machine](https://github.com/Alifromtheends/ninja-money-machine) portfolio.

## Try it

[Live Demo](https://seed-dev-tool-1779205224843.vercel.app)
