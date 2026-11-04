# Sandbox Check

What can untrusted HTML reach from your preview iframe? Set up a frame the way your chat app or artifact feature renders model-written HTML, and a probe page inside it tries, harmlessly, to read your cookies, call your API, send data out, submit forms and move your tab. You get a pass/fail report with the fix for each leak.

Live: https://sandbox-check.netlify.app

- Pick `srcdoc`, a blob URL or a `data:` URL, toggle each `sandbox` token, add a CSP inside the frame and a Permissions Policy, or start from a preset such as the classic `allow-scripts allow-same-origin` mistake.
- Some tokens only unlock after a click, so the probe page has a button that tests popups and top navigation with a real click.
- Copy the report as Markdown, copy a link to the setup, or copy the iframe snippet.
- "Test your own app" copies the probe as standalone HTML you can render in any preview feature; it reports from inside the frame.
- Every probe reads but never writes, installs nothing and only requests files from the kit's own origin.
