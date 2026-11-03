# Deslop Detector: Score Text for LLM Tics

Idea #22 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

Paste text and get a highlighted heatmap of common AI writing tics (em-dash spam, 'delve', rule-of-three, 'it's not
X, it's Y'). Optionally run a small local model, such as Qwen3-4B, to rewrite the flagged lines. It could be a
browser-only tool with a shareable 'slop score'.

## Why now

A Qwen3-4B variant with writing tics trained out hit 116 points on HN, so people are interested in measuring and
removing slop.

## Sparked by

- [Show HN: Qwen3-4B with the AI writing tics trained out](https://100toolkit.com/blog/deslop-model/) ([HN thread](https://news.ycombinator.com/item?id=50151928))

## Scope for v0.1

- Static Vite + TypeScript page, no runtime dependencies. Detection runs in the browser; nothing is uploaded.
- 16 regex rules (em dash, not X but Y, list of three, buzzwords, grandiose, signposts, asked-and-answered
  questions, chatbot frames, "serves as", -ing tails, from X to Y, performative honesty, listicles, short fragments,
  markdown, emoji), each with a weight. The score is weighted tics per 1000 words, on the same scale as the post's
  detector (people under 15, stock Qwen3-4B about 120). On the post's 80 sample answers it averages 122 before and
  7 after (theirs: 121 and 13), correlation 0.95.
- Live heatmap behind the textarea, a legend that isolates one habit, a list of findings that jumps to each one,
  and three samples (chatbot blog post, LinkedIn post, plain human note).
- Shareable 1200×630 score card (native share with the PNG, else link copy, plus download). The link carries the
  score and breakdown; optionally the text too, deflate-compressed in the URL fragment so it never hits a server.
- Optional rewrite: connect to the visitor's own Ollama (`OLLAMA_ORIGINS` set to the site) running
  `qwen3-4b-deslop` and rewrite only the flagged paragraphs, streamed, with a before/after score and "use this
  version". The site never calls a hosted model.
- Mobile-first, og:image.
