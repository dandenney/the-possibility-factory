# Electron Diet: How Much RAM Is Your Desktop App Wasting?

Idea #123 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A tiny dashboard that people can paste process-list output into (ps, Task Manager CSV). It groups processes by
Electron, WebView2, or native, estimates the RAM an app would save if it dropped Electron, and ranks the offenders.
The shareable result is a 'Discord-style' before/after bar chart.

## Why now

Discord's lighter, non-Electron Windows 11 app, with about 70% less RAM, is being discussed widely. Libghostty 1.0
also shows how native-core, embeddable approaches are gaining ground.

## Sparked by

- [Every Windows 11 app should kill Electron, and Discord just showed why](https://www.windowslatest.com/2026/11/06/every-windows-11-app-should-kill-electron-and-70-less-ram-even-with-two-accounts-signed-in/)
- [Libghostty 1.0](https://mitchellh.com/writing/libghostty-1-0)

## Scope for v0.1

- Built with [Exact](https://github.com/expo/exact), Expo's pre-alpha Contract + TypeScript framework, as a test of
  it: one app that ships as a web page and a native Mac app (AppKit, no web view).
- Web: paste `ps -axo rss=,comm=`, `ps aux`, or Windows `tasklist` (table or `/fo csv`) output, or try a sample Mac.
  Everything runs in the browser.
- Mac app: a "Scan This Mac" button. A Swift module reads every process through libproc (memory footprint, as
  Activity Monitor shows it) and checks each app bundle for `Electron Framework.framework`, so nothing is pasted.
- Groups processes by app (a Mac helper counts toward its outermost `.app`), sorts each app into Electron, WebView2,
  browser or native, and assumes a native rewrite uses 70% less RAM, as Discord's did.
- A summary of what Electron could give back, a before/after bar chart of the offenders (Share Card on the Mac
  shares it as a picture), share and copy a one-line result, and a table of everything running.
