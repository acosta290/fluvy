// every language's words are here before a test runs: a lookup never waits on a fetch
import { preloadLanguages } from '@fluvy/core';

await preloadLanguages();
