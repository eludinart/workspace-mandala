import { DEFAULT_THEME_MODE, DEFAULT_THEME_PALETTE, THEME_PALETTES } from '@/lib/theme/tokens'

/** Script inline exécuté avant le premier paint (évite le flash + applique les variables CSS). */
export function buildThemeInitScript(): string {
  const palettes = JSON.stringify(THEME_PALETTES)
  return `(function(){try{var P=${palettes};var m=localStorage.getItem('mdl_theme_mode')==='light'?'light':'dark';var p=localStorage.getItem('mdl_theme_palette')||'${DEFAULT_THEME_PALETTE}';if(!P[p])p='${DEFAULT_THEME_PALETTE}';var t=P[p];var s=m==='light'?t.light:t.dark;var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(m);r.setAttribute('data-palette',p);r.style.colorScheme=m;Object.keys(s).forEach(function(k){r.style.setProperty('--slate-'+k,s[k]);});Object.keys(t.accent).forEach(function(k){r.style.setProperty('--accent-'+k,t.accent[k]);});r.style.setProperty('--foreground-rgb',s[100]);r.style.setProperty('--background-rgb',s[950]);r.style.setProperty('--scrollbar-thumb',m==='light'?'161 161 170':'51 65 85');r.style.setProperty('--scrollbar-track',m==='light'?s[900]:s[950]);}catch(e){document.documentElement.classList.add('${DEFAULT_THEME_MODE}');}})();`
}
