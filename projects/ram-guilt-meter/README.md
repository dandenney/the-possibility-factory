# RAM Guilt Meter

Is your browser tab stealing Altman's DRAM? Confess how many tabs you have open and find out how much memory
you're hoarding from the data centers, how many tokens of context it could have held, and how guilty you should
feel about it. Then share your guilt card, or donate your RAM.

Live: https://ram-guilt-meter.netlify.app

- Drag the slider (or type) your tab count, pick how heavy your tabs are, and confirm your RAM.
- In Chrome and Edge it also reads what the browser reports about your device and this tab's own memory.
- Skip the honor system: `curl -fsSL https://ram-guilt-meter.netlify.app/measure.sh | sh` counts your real tabs (macOS) and browser memory, then opens your card with them. Nothing is uploaded.
- Share sends the card image where your device supports it, otherwise a link that recreates your card.
- "How the math works" on the page explains every number. Satire; not affiliated with OpenAI.
