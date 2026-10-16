// Run JavaScript inside the app's WebView through the Chrome DevTools protocol, so the CI
// smoke test can click real buttons and read real screen text (the WebView is not visible to
// uiautomator). Needs: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>.
// Usage: node scripts/cdp.mjs "<javascript expression>"   (prints the result)
const expression = process.argv[2] ?? '';
const port = process.env.CDP_PORT ?? '9222';

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) {
  console.error('no WebView page found:', JSON.stringify(targets).slice(0, 300));
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error('websocket error'));
});
const reply = await new Promise((resolve) => {
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === 1) resolve(m);
  };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
});
ws.close();
const r = reply.result?.result;
console.log(r && 'value' in r ? r.value : JSON.stringify(reply));
