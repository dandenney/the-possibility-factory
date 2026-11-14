// Generated: the grant admission of a page that admits nothing (LLP 1047.002 D3). Every set is the empty set the compiler normalized.
const EMPTY = Object.freeze({ ...{"entries":[],"error":null,"keepsNoAnswers":false,"seal":"74683c7cc22e0beb","version":1}, entries: Object.freeze([]) });
export const admitsNetwork = () => false;
export const admitsSecret = () => false;
export const admittingGrant = () => null;
export const coversPath = () => false;
export const createGrantSet = () => EMPTY;
export const grantError = () => null;
export const grantWords = (value) => String(value).split(/\p{White_Space}+/u).filter(Boolean);
export const hasGrant = () => false;
export const rawGrantText = () => '';
export const sameGrantDeclaration = (set, source) => typeof source === 'string';
export const scopedGrantSet = () => EMPTY;
export const socketProtocols = (value) => { if (value === undefined) return []; throw new TypeError('exactProtocols: no grant admits a WebSocket stream'); };
export const trimGrant = (value) => String(value).replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
export const unionGrantSets = () => EMPTY;
export { isCloudMetadata, isLocalNetwork } from './grant-network.js';