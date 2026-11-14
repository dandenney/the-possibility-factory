# Electron Diet

How much RAM are your Electron apps wasting? Paste your process list (or, in the Mac app, press Scan This Mac) and
Electron Diet adds up each app's memory, picks out the ones built on Electron or WebView2, and shows what they'd give
back as native apps, using the 70% drop Discord's lighter Windows 11 app showed. It's built with
[Exact](https://github.com/expo/exact), Expo's new framework, so the same app is a web page and a native Mac app.

Live: https://electron-diet.netlify.app

- Run `ps -axo rss=,comm= | pbcopy` (Mac, Linux) or `tasklist /fo csv | clip` (Windows) and paste, or try the sample Mac.
- A before/after bar chart ranks the offenders; share or copy the result.
- The Mac app reads every running process itself through a small Swift module. Nothing leaves your machine either way.
- Build the Mac app yourself: see `AGENTS.md`. Exact is pre-alpha.
