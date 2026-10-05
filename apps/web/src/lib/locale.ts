'use client';

import { useSyncExternalStore } from 'react';

export const LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

const COPY: Record<Locale, Record<string, string>> = {
  en: {
    'nav.create': 'Create',
    'nav.find': 'Find',
    'nav.pricing': 'Pricing',
    'nav.help': 'Help',
    'nav.signin': 'Sign in',
    'nav.start': 'Get started',
    'hero.title': 'A live bracket and a real venue schedule.',
    'hero.body':
      'Share one link. Score from your phone. Courts, rest rules and blackouts stay in sync with the bracket — including ball-by-ball cricket, which the usual bracket tools do not run.',
    'hero.fine': 'Starter is free for one active tournament · Viewers never need an account',
    'footer.blurb':
      'Run any tournament. Brackets, schedules and live results for clubs, leagues, esports and everything in between.',
  },
  es: {
    'nav.create': 'Crear',
    'nav.find': 'Buscar',
    'nav.pricing': 'Precios',
    'nav.help': 'Ayuda',
    'nav.signin': 'Entrar',
    'nav.start': 'Empezar',
    'hero.title': 'Un cuadro en vivo y un horario de sede de verdad.',
    'hero.body':
      'Comparte un enlace. Anota desde el teléfono. Pistas, descansos y bloqueos siguen el cuadro, incluido el críquet bola a bola.',
    'hero.fine': 'Starter es gratis para un torneo activo · Quien mira no necesita cuenta',
    'footer.blurb': 'Organiza cualquier torneo. Cuadros, horarios y resultados en vivo.',
  },
  fr: {
    'nav.create': 'Créer',
    'nav.find': 'Trouver',
    'nav.pricing': 'Tarifs',
    'nav.help': 'Aide',
    'nav.signin': 'Connexion',
    'nav.start': 'Commencer',
    'hero.title': 'Un tableau en direct et un vrai planning de salle.',
    'hero.body':
      'Un seul lien. Les scores se saisissent au téléphone. Terrains, repos et blackouts restent alignés sur le tableau, cricket balle par balle compris.',
    'hero.fine': 'Starter est gratuit pour un tournoi actif · Les spectateurs n’ont pas besoin de compte',
    'footer.blurb': 'Organisez n’importe quel tournoi. Tableaux, plannings et résultats en direct.',
  },
  de: {
    'nav.create': 'Erstellen',
    'nav.find': 'Finden',
    'nav.pricing': 'Preise',
    'nav.help': 'Hilfe',
    'nav.signin': 'Anmelden',
    'nav.start': 'Loslegen',
    'hero.title': 'Ein Live-Tableau und ein echter Spielplan.',
    'hero.body':
      'Ein Link. Ergebnisse vom Handy. Plätze, Pausen und Sperrzeiten bleiben am Tableau, inklusive Cricket Ball für Ball.',
    'hero.fine': 'Starter ist frei für ein aktives Turnier · Zuschauer brauchen kein Konto',
    'footer.blurb': 'Jedes Turnier. Tableaus, Spielpläne und Live-Ergebnisse.',
  },
  pt: {
    'nav.create': 'Criar',
    'nav.find': 'Encontrar',
    'nav.pricing': 'Preços',
    'nav.help': 'Ajuda',
    'nav.signin': 'Entrar',
    'nav.start': 'Começar',
    'hero.title': 'Uma chave ao vivo e uma agenda de quadra de verdade.',
    'hero.body':
      'Um link. Placar no telemóvel. Quadras, descanso e bloqueios acompanham a chave, incluindo críquete bola a bola.',
    'hero.fine': 'Starter é grátis para um torneio ativo · Quem assiste não precisa de conta',
    'footer.blurb': 'Organize qualquer torneio. Chaves, agendas e resultados ao vivo.',
  },
  bn: {
    'nav.create': 'তৈরি',
    'nav.find': 'খুঁজুন',
    'nav.pricing': 'মূল্য',
    'nav.help': 'সাহায্য',
    'nav.signin': 'প্রবেশ',
    'nav.start': 'শুরু',
    'hero.title': 'লাইভ ব্র্যাকেট আর আসল ভেন্যুর সময়সূচি।',
    'hero.body':
      'একটা লিংক। ফোন থেকে স্কোর। কোর্ট, বিরতি আর ব্ল্যাকআউট ব্র্যাকেটের সাথে থাকে — বল-বাই-বল ক্রিকেটসহ।',
    'hero.fine': 'স্টার্টার একটা সক্রিয় টুর্নামেন্টে ফ্রি · দর্শকদের অ্যাকাউন্ট লাগে না',
    'footer.blurb': 'যেকোনো টুর্নামেন্ট। ব্র্যাকেট, সময়সূচি আর লাইভ ফল।',
  },
};

const EVENT = 'bracket-locale';

export function readLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|; )bracket_locale=([^;]+)/);
  const value = match?.[1];
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
}

export function writeLocale(locale: Locale) {
  document.cookie = `bracket_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(EVENT, onStoreChange);
  return () => window.removeEventListener(EVENT, onStoreChange);
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribe, readLocale, () => 'en' as Locale);
  return {
    locale,
    t: (key: string) => COPY[locale][key] ?? COPY.en[key] ?? key,
    setLocale: writeLocale,
  };
}
