import { buildThemeInitScript } from '@/lib/theme/build-init-script'

/** Applique le thème avant le premier paint pour éviter un flash. */
export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
}
