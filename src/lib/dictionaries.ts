import 'server-only';

const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  ar: () => import('@/dictionaries/ar.json').then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  const dict = dictionaries[locale as keyof typeof dictionaries];
  return dict ? dict() : dictionaries['en']();
};
