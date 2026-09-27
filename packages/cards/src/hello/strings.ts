import { createStrings } from '@fluvy/core';

/** The greetings themselves are shared words (`greeting.*`), and the condition words come from the weather card's table. */
export const s = createStrings({
  en: { greeting: '{greeting}, {name}', profile: 'Profile' },
  es: { greeting: '{greeting}, {name}', profile: 'Perfil' },
});
