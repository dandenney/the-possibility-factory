import type { Answer, Result, Sources } from './app.contract.d.ts';
import { analyze } from './diet.ts';
import { SAMPLE } from './sample.ts';

export const grants = '';

const sources: Sources = {
  analyze: ([text, electronApps]): Result<'analyze'> => analyze(text, electronApps.split('\n').filter(Boolean)),
  sample: (): Result<'sample'> => ({ text: SAMPLE }),
  scanner: (_args, _store, _storage, native): Result<'scanner'> => ({ available: Boolean(native?.available) }),
  // The Mac app reads every process it may (libproc), in `ps -axo rss=,comm=`'s form, and names the
  // bundles that ship Electron Framework, so an app missing from diet.ts's lists still counts.
  scanMac: async (_args, _store, _storage, native): Promise<Result<'scanMac'>> => {
    if (!native?.available) return { text: '', electronApps: '', error: 'Scanning needs the Mac app.' };
    return await native.later({}) as Result<'scanMac'>;
  },
};
export const answer: Answer = (source, args, store, storage, native) =>
  sources[source](args, store, storage, native);
