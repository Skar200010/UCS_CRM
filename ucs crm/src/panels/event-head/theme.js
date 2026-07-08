export const themes = {
  sage: {
    name: 'Sage (Default)',
    sand: '#F3EFE7',
    paper: '#FBFAF6',
    ink: '#232019',
    'ink-soft': '#6F6857',
    line: '#E4DECF',
    sage: '#5B6B4E',
    'sage-soft': '#E8EDE1',
    clay: '#B5603A',
    'clay-soft': '#F4E4DA',
    gold: '#C08A2E',
    'gold-soft': '#F6EAD0',
    danger: '#9E3B2E',
    'danger-soft': '#F3DDD8',
    radius: '12px',
    'radius-sm': '8px',
  },

  ocean: {
    name: 'Ocean',
    sand: '#EFF4F8',
    paper: '#F8FAFC',
    ink: '#0F172A',
    'ink-soft': '#475569',
    line: '#CBD5E1',
    sage: '#1E6F9F',
    'sage-soft': '#DBEAFE',
    clay: '#D97706',
    'clay-soft': '#FEF3C7',
    gold: '#A16207',
    'gold-soft': '#FEF9C3',
    danger: '#DC2626',
    'danger-soft': '#FEE2E2',
    radius: '12px',
    'radius-sm': '8px',
  },

  sky: {
    name: 'Sky',
    sand: '#F0F7FF',
    paper: '#F8FBFF',
    ink: '#0B1E36',
    'ink-soft': '#4A6488',
    line: '#C4D8F0',
    sage: '#3485D4',
    'sage-soft': '#D4E6FF',
    clay: '#E07B3A',
    'clay-soft': '#F5E6D8',
    gold: '#B8860B',
    'gold-soft': '#FFF8DC',
    danger: '#C0392B',
    'danger-soft': '#F5D6D3',
    radius: '12px',
    'radius-sm': '8px',
  },

  marine: {
    name: 'Marine',
    sand: '#EAF2F8',
    paper: '#F4F9FC',
    ink: '#0A1E2E',
    'ink-soft': '#3D5A72',
    line: '#BFD5E8',
    sage: '#1A6B8A',
    'sage-soft': '#D0E6F2',
    clay: '#C96A2B',
    'clay-soft': '#F5E0D0',
    gold: '#8B7A1A',
    'gold-soft': '#FCF3D0',
    danger: '#B03A2E',
    'danger-soft': '#F2D6D2',
    radius: '12px',
    'radius-sm': '8px',
  },

  indigo: {
    name: 'Indigo',
    sand: '#EEF0F9',
    paper: '#F7F8FC',
    ink: '#141838',
    'ink-soft': '#444C78',
    line: '#C2C8E8',
    sage: '#4F5DB0',
    'sage-soft': '#D5DAF2',
    clay: '#C95A2B',
    'clay-soft': '#F5E0D6',
    gold: '#8B7A1A',
    'gold-soft': '#FCF3D0',
    danger: '#B03A3A',
    'danger-soft': '#F2D6D6',
    radius: '12px',
    'radius-sm': '8px',
  },

  steel: {
    name: 'Steel',
    sand: '#EBF0F5',
    paper: '#F5F7FA',
    ink: '#141E28',
    'ink-soft': '#405060',
    line: '#BCC8D6',
    sage: '#3C6B9C',
    'sage-soft': '#CEDCF0',
    clay: '#C06030',
    'clay-soft': '#F0E0D4',
    gold: '#8B7320',
    'gold-soft': '#FCF0CC',
    danger: '#A83838',
    'danger-soft': '#F0D6D6',
    radius: '12px',
    'radius-sm': '8px',
  },

  iceberg: {
    name: 'Iceberg',
    sand: '#F2F5FA',
    paper: '#FAFCFE',
    ink: '#1A2638',
    'ink-soft': '#4A5A70',
    line: '#C8D4E6',
    sage: '#5A8BBF',
    'sage-soft': '#D6E4F5',
    clay: '#CC7030',
    'clay-soft': '#F5E4D4',
    gold: '#9A8228',
    'gold-soft': '#FCF4D4',
    danger: '#B04040',
    'danger-soft': '#F2DADA',
    radius: '12px',
    'radius-sm': '8px',
  },
};

export function applyTheme(theme, panelClass) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'name') continue;
    root.style.setProperty(`--${key}`, value);
  }
  if (panelClass) {
    const panel = document.querySelector(panelClass);
    if (panel) {
      for (const [key, value] of Object.entries(theme)) {
        if (key === 'name') continue;
        panel.style.setProperty(`--${key}`, value);
      }
    }
  }
}
