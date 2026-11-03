# Product

<!-- impeccable:product-schema 1 -->

Init answers were filled in by Devin from SPEC.md, the factory board and Dan's feedback, not from a live interview. Items marked *(inferred)* have not been confirmed by Dan.

## Platform

web

## Users

- People who write for work or post online (blog posts, LinkedIn, newsletters, emails) and want to know whether their draft reads like a chatbot wrote it before they publish. They paste a draft, scan what got flagged, fix it, and paste again. *(inferred)*
- Curious visitors arriving from a shared score link or card, often from Hacker News or social, who paste something to see what score it gets. *(inferred)*
- A smaller technical group who run Ollama locally and want the flagged paragraphs rewritten by the de-slopped Qwen3-4B model.

## Product Purpose

Score a piece of text for common AI writing habits and show exactly where they are, so the writer can reread and revise. Success means a visitor understands their score and the top habits within seconds of pasting, and can share the result.

## Positioning

A writing checker for AI habits rather than an "AI detector": it names the specific habit behind every flag (em dashes, "it's not X, it's Y", lists of three, "delve"), and its score uses the same per-1,000-word scale as the deslop-model post that inspired it. Everything runs in the browser; text never leaves the page unless the visitor chooses to put it in a share link.

## Operating Context

- Used alongside a draft in another tab or app: paste, read the flags, edit in place or back in the original tool.
- Shared links and 1200×630 score cards travel through social posts and chat.
- Optional rewrite runs against the visitor's own Ollama on localhost with `OLLAMA_ORIGINS` set to the site.

## Capabilities and Constraints

- Static Vite + TypeScript page, no runtime dependencies, deployed to Netlify at https://deslop-detector.netlify.app.
- 16 regex rules with weights; score = weighted flags per 1,000 words; tiers from "Reads human" (<15) to "Pure slop" (150+). Texts under 40 words get no score.
- Three samples: chatbot blog post, LinkedIn post, a note a person wrote.
- Share: native share with the PNG card when available, otherwise copy link; download card. Link carries score and breakdown, optionally the deflate-compressed text in the URL fragment.
- Never calls a hosted model; the rewrite feature only talks to the visitor's local Ollama.
- Standalone project in the possibility-factory monorepo; must not import from `apps/` or `packages/`.

## Brand Commitments

- Name: Deslop Detector.
- Dan's binding direction for the editor: "a lighter touch on writing, similar to grammarly". He rejected the earlier dark, many-colored version as "a crayon box".
- Voice: plain and slightly dry; the page itself must not use the habits it flags.

## Evidence on Hand

- Calibration against the source post's 40 before/after examples: about 122 before and 7 after (the post reports 121 and 13), correlation 0.95. Documented in SPEC.md.
- No testimonials, user counts or press. Do not invent any.

## Product Principles

- Point at the sentence, not at the writer: a high score is a reason to reread, never proof that AI wrote it.
- The text is the hero; feedback stays quiet until asked for.
- Private by default: nothing leaves the browser without an explicit choice.
- Every flag explains itself in one line.

## Accessibility & Inclusion

WCAG AA contrast and full keyboard use of the editor, habit filters and flag list. *(inferred)*
