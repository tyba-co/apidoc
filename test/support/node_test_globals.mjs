import { describe, it, before, after } from 'node:test';

const adaptDoneCallback = testFunction => (testFunction?.length > 0 ? (_context, done) => testFunction(done) : testFunction);

globalThis.describe = describe;
globalThis.before = hook => before(adaptDoneCallback(hook));
globalThis.after = hook => after(adaptDoneCallback(hook));
globalThis.it = (title, testFunction) => {
  it(title, adaptDoneCallback(testFunction));
  return { timeout () {} }; // node:test has no default timeout; keeps mocha's it().timeout() chain callable
};
