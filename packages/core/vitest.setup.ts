// every language's words are here before a test runs: a lookup never waits on a fetch
import { preloadLanguages } from './src/i18n/index.js';

await preloadLanguages();
