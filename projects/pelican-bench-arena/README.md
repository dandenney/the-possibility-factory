# Pelican Bench Arena

Which model draws the best pelican riding a bicycle? This week's new models (Gemini 4 Argon, Muse Spark Open,
LFM2.5-24B-A2B, Beam 1.0) and a few old favorites each got Simon Willison's prompt,
"Generate an SVG of a pelican riding a bicycle". Pick the better pelican without knowing who drew it, then see the
leaderboard.

Live: https://pelican-bench-arena.netlify.app

- Two pelicans, A or B or tie. The names show up after you vote. Keyboard: ← → ↓, Enter for the next pair.
- The leaderboard ranks everyone's votes (Bradley-Terry, Elo-style scale), or just yours.
- "Every pelican" shows all three drawings per model with how many tokens and seconds each took.
- Drawings were generated once through OpenRouter with default settings; nothing calls a model while you browse.
