# Deslop Detector

Does this read like a chatbot wrote it? Paste some text and the AI writing habits get underlined, Grammarly-style: em dashes, "it's not X, it's Y", lists of three, "delve", questions answered on the spot, and a dozen more. You get a slop score per 1,000 words (careful people score under 15, a stock chatbot about 120) and a card to share.

Live: https://deslop-detector.netlify.app

- Everything runs in your browser. Share links carry the score; tick a box to include your text, which rides in the URL fragment and never reaches a server.
- Tap a habit to see only that one, or tap a finding to jump to it in the text.
- Running [Ollama](https://ollama.com)? Pull [qwen3-4b-deslop](https://huggingface.co/erikkannike/qwen3-4b-deslop-v4), start it with `OLLAMA_ORIGINS` set to the site, and the page can rewrite just the flagged paragraphs on your own machine.
- "How the score works" on the page lists every rule and its weight. It's a regex: a high score is a reason to reread, not proof.
