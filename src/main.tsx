/** Browser entry point. Loaded as an external module script, so the CSP needs no inline code. */
import '@fontsource-variable/manrope/wght.css';
import { render } from 'preact';
import { applyDensity, applyTheme, getPrefs } from '@/data/prefs';
import { initPwa } from '@/services/pwa';
import { App } from '@/ui/App';

applyTheme(getPrefs().theme);
applyDensity(getPrefs().density);
initPwa();
render(<App />, document.getElementById('app')!);
