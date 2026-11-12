export const THEME_COOKIE = 'b26_theme'
export type Theme = 'system' | 'light' | 'dark'
export const THEME_BG = { light: '#ffffff', dark: '#262626' } as const
export const parseTheme = (v: string | undefined): Theme => (v === 'light' || v === 'dark' ? v : 'system')
