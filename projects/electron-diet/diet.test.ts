import { describe, expect, test } from 'bun:test';
import { analyze, appName, parse } from './diet.ts';
import { SAMPLE } from './sample.ts';

describe('parse', () => {
  test('ps -axo rss=,comm= with full Mac paths', () => {
    const { lines, format } = parse('  612000 /Applications/Slack.app/Contents/MacOS/Slack\n41000 /usr/libexec/trustd');
    expect(format).toBe('ps');
    expect(lines).toEqual([{ kb: 612000, command: '/Applications/Slack.app/Contents/MacOS/Slack' }, { kb: 41000, command: '/usr/libexec/trustd' }]);
  });
  test('ps aux keeps the RSS column and the whole command', () => {
    const text = 'USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND\ndan 812 3.1 2.0 412 204800 ?? S 9:01AM 0:42.10 /Applications/Discord.app/Contents/MacOS/Discord --flag';
    expect(parse(text)).toEqual({ lines: [{ kb: 204800, command: '/Applications/Discord.app/Contents/MacOS/Discord --flag' }], format: 'ps aux' });
  });
  test('tasklist as a table and as CSV', () => {
    const table = 'Image Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\nDiscord.exe                   4120 Console                    1    412,300 K';
    expect(parse(table).lines).toEqual([{ kb: 412300, command: 'Discord.exe' }]);
    expect(parse('"Code.exe","9","Console","1","98.304 K"').lines).toEqual([{ kb: 98304, command: 'Code.exe' }]);
  });
  test('prose reads as nothing', () => {
    expect(parse('hello there\nthis is not ps').lines).toEqual([]);
  });
});

describe('appName', () => {
  test('a helper belongs to its outermost bundle', () => {
    expect(appName('/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Renderer).app/Contents/MacOS/Code Helper (Renderer)')).toBe('Visual Studio Code');
  });
  test('Windows and Linux executables get their usual names', () => {
    expect(appName('Code.exe')).toBe('Visual Studio Code');
    expect(appName('msedgewebview2.exe')).toBe('WebView2 runtime');
    expect(appName('slack')).toBe('Slack');
  });
});

describe('analyze', () => {
  test('the sample ranks Electron apps by what they would give back', () => {
    const r = analyze(SAMPLE);
    expect(r.offenders.map(o => o.name)).toEqual(['Visual Studio Code', 'Slack', 'Figma', 'Discord', 'Notion', 'Obsidian']);
    expect(r.top.find(a => a.name === 'Google Chrome')?.kind).toBe('browser');
    expect(r.top.find(a => a.name === 'Safari')?.processes).toBe(2);
    expect(r.savedText).toBe('3.7 GB');
  });
  test('a bundle the Mac app found Electron Framework in counts even when unlisted', () => {
    const text = '300000 /Applications/Hypothetical.app/Contents/MacOS/Hypothetical';
    expect(analyze(text).offenders).toEqual([]);
    expect(analyze(text, ['Hypothetical']).offenders[0]?.savedText).toBe('205 MB');
  });
  test('an app named Electron-something is not Electron by name alone', () => {
    const text = '60000 /Applications/Electron Diet.app/Contents/MacOS/Electron Diet\n90000 /usr/lib/electron/electron --type=renderer\n80000 /Applications/Electron.app/Contents/MacOS/Electron';
    const kinds = Object.fromEntries(analyze(text).top.map(a => [a.name, a.kind]));
    expect(kinds['Electron Diet']).toBe('native');
    expect(kinds['Electron']).toBe('electron');
  });
  test('nothing heavy says so', () => {
    expect(analyze('100000 /usr/libexec/trustd').headline).toStartWith('No Electron');
  });
});
