/** Browser entry point. Loaded as an external module script, so the CSP needs no inline code. */
import '@fontsource-variable/manrope/wght.css';
import { render } from 'preact';
import { App } from './components/App';
import { applyTheme, getPrefs } from './lib/prefs';
import { initPwa } from './lib/pwa';

applyTheme(getPrefs().theme);
initPwa();
render(<App />, document.getElementById('app')!);
