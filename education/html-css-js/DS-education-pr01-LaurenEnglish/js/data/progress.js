export const STORAGE_KEY = 'lauren_progress_v1';

export const TRACKS = [
  {
    id: 'vocab',
    label: 'Słownictwo',
    description: 'Nowe słowa, powtórki i aktywne użycie w zdaniach.'
  },
  {
    id: 'grammar',
    label: 'Gramatyka',
    description: 'Ćwiczenia struktur i świadome budowanie zdań.'
  },
  {
    id: 'speaking',
    label: 'Mówienie',
    description: 'Sesje mówienia: płynność, pewność i wymowa.'
  }
];

export const DEFAULT_GOALS = {
  vocab: 3,
  grammar: 2,
  speaking: 2
};

export const WEEKDAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
