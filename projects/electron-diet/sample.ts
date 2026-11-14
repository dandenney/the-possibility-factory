// A typical work Mac, as `ps -axo rss=,comm=` prints it (resident KB, then the executable).
const A = '/Applications';
const helper = (app: string, name: string, kinds: [string, number][]) =>
  kinds.map(([kind, kb]) => `${kb} ${A}/${app}.app/Contents/Frameworks/${name} Helper${kind ? ` (${kind})` : ''}.app/Contents/MacOS/${name} Helper${kind ? ` (${kind})` : ''}`);
const electron = (app: string, name: string, main: number, helpers: [string, number][]) =>
  [`${main} ${A}/${app}.app/Contents/MacOS/${name}`, ...helper(app, name, helpers)];

export const SAMPLE = [
  ...electron('Slack', 'Slack', 214_000, [['Renderer', 612_000], ['Renderer', 188_000], ['GPU', 142_000], ['', 61_000]]),
  ...electron('Discord', 'Discord', 176_000, [['Renderer', 498_000], ['GPU', 121_000], ['', 54_000]]),
  ...electron('Visual Studio Code', 'Code', 162_000, [['Renderer', 541_000], ['Plugin', 402_000], ['Plugin', 233_000], ['GPU', 96_000], ['', 48_000]]),
  ...electron('Notion', 'Notion', 141_000, [['Renderer', 389_000], ['GPU', 88_000]]),
  ...electron('Figma', 'Figma', 128_000, [['Renderer', 644_000], ['GPU', 203_000]]),
  ...electron('Obsidian', 'Obsidian', 96_000, [['Renderer', 211_000], ['GPU', 64_000]]),
  `${188_000} ${A}/Google Chrome.app/Contents/MacOS/Google Chrome`,
  ...[402_000, 288_000, 231_000, 176_000, 142_000, 98_000].map(kb => `${kb} ${A}/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/131.0.6778.86/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer)`),
  `${152_000} ${A}/Safari.app/Contents/MacOS/Safari`,
  `${241_000} /System/Library/Frameworks/WebKit.framework/Versions/A/XPCServices/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent`,
  `${318_000} /System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer`,
  `${121_000} /System/Library/CoreServices/Finder.app/Contents/MacOS/Finder`,
  `${148_000} /System/Applications/Mail.app/Contents/MacOS/Mail`,
  `${96_000} /System/Applications/Messages.app/Contents/MacOS/Messages`,
  `${88_000} ${A}/Ghostty.app/Contents/MacOS/ghostty`,
  `${172_000} ${A}/Spotify.app/Contents/MacOS/Spotify`,
  `${64_000} /System/Library/CoreServices/Dock.app/Contents/MacOS/Dock`,
  `${41_000} /usr/libexec/trustd`,
  `${38_000} /usr/sbin/cfprefsd`,
].join('\n');
