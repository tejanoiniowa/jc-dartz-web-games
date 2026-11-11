// ble.js — connects to a Granboard (or JCDartz in Granboard mode) with Web Bluetooth
// Hits arrive as ASCII packets like "3.4@" (= T20). "BTN@" is the red / change button.
'use strict';

const Board = (() => {
  const SVC = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
  const NOTIFY = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';
  const WRITE = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';

  // Granboard packet -> segment (same table JCDartz uses for its Granboard mode)
  const PKT = {'2.3':'S1I','2.5':'S1O','2.4':'T1','2.6':'D1','9.1':'S2I','9.2':'S2O','9.0':'T2','8.2':'D2','7.1':'S3I','7.2':'S3O','7.0':'T3','8.4':'D3','0.1':'S4I','0.5':'S4O','0.3':'T4','0.6':'D4','5.1':'S5I','5.4':'S5O','5.2':'T5','4.6':'D5','1.0':'S6I','1.3':'S6O','1.1':'T6','4.4':'D6','11.1':'S7I','11.4':'S7O','11.2':'T7','8.6':'D7','6.2':'S8I','6.5':'S8O','6.4':'T8','6.6':'D8','9.3':'S9I','9.5':'S9O','9.4':'T9','9.6':'D9','2.0':'S10I','2.2':'S10O','2.1':'T10','4.3':'D10','7.3':'S11I','7.5':'S11O','7.4':'T11','7.6':'D11','5.0':'S12I','5.5':'S12O','5.3':'T12','5.6':'D12','0.0':'S13I','0.4':'S13O','0.2':'T13','4.5':'D13','10.3':'S14I','10.5':'S14O','10.4':'T14','10.6':'D14','3.0':'S15I','3.2':'S15O','3.1':'T15','4.2':'D15','11.0':'S16I','11.5':'S16O','11.3':'T16','11.6':'D16','10.1':'S17I','10.2':'S17O','10.0':'T17','8.3':'D17','1.2':'S18I','1.5':'S18O','1.4':'T18','1.6':'D18','6.1':'S19I','6.3':'S19O','6.0':'T19','8.5':'D19','3.3':'S20I','3.5':'S20O','3.4':'T20','3.6':'D20','8.0':'SB','4.0':'DB'};

  // Segment IDs the LED ring uses for a hit flash, per number
  const LED_ID = {1:0x1C,2:0x31,3:0x37,4:0x22,5:0x16,6:0x28,7:0x01,8:0x07,9:0x10,10:0x2B,11:0x0A,12:0x13,13:0x25,14:0x0D,15:0x2E,16:0x04,17:0x34,18:0x1F,19:0x3A,20:0x19};
  const COLOR = { off: 0, red: 1, orange: 2, yellow: 3, green: 4, turq: 5, purple: 6, white: 7 };

  let device = null, wchar = null, buf = '', state = 'off', name = '';
  let onHit = () => {}, onButton = () => {}, onState = () => {};
  let writeQ = Promise.resolve(), pending = 0, lastRing = '';

  const supported = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);

  function setState(s, msg) { state = s; onState(s, msg); }

  async function connect(showAll) {
    if (!supported()) {
      UI.toast(window.isSecureContext ? 'This browser has no Bluetooth. Use Chrome on Android.' : 'Bluetooth needs the https:// page');
      return;
    }
    try {
      const opts = showAll
        ? { acceptAllDevices: true, optionalServices: [SVC] }
        : { filters: [{ namePrefix: 'GRANBOARD' }, { namePrefix: 'Granboard' }, { services: [SVC] }], optionalServices: [SVC] };
      const dev = await navigator.bluetooth.requestDevice(opts);
      await attach(dev);
    } catch (e) {
      if (e && e.name === 'NotFoundError') return; // picker closed
      setState('off');
      UI.toast('Could not connect: ' + (e && e.message || e));
    }
  }

  async function attach(dev) {
    device = dev;
    name = dev.name || 'BOARD';
    if (!dev.__jc) {
      dev.__jc = true;
      dev.addEventListener('gattserverdisconnected', () => { wchar = null; setState('off', 'Board disconnected'); reconnect(); });
    }
    setState('busy');
    const server = await dev.gatt.connect();
    const svc = await server.getPrimaryService(SVC);
    const nchar = await svc.getCharacteristic(NOTIFY);
    try { wchar = await svc.getCharacteristic(WRITE); } catch (e) { wchar = null; }
    nchar.addEventListener('characteristicvaluechanged', ev => feed(ev.target.value));
    await nchar.startNotifications();
    if (wchar) { try { await wchar.writeValue(new TextEncoder().encode('GB7;101')); } catch (e) {} }
    lastRing = '';
    setState('ok');
  }

  let retrying = false;
  async function reconnect() {
    if (!device || retrying) return;
    retrying = true;
    for (let i = 0; i < 5 && state !== 'ok'; i++) {
      await new Promise(r => setTimeout(r, 1500 + i * 1000));
      try { await attach(device); } catch (e) {}
    }
    retrying = false;
  }

  // Board remembered from last time (Chrome only lets us reconnect to boards it already allowed)
  async function autoConnect() {
    if (!supported() || !navigator.bluetooth.getDevices) return;
    try {
      const devs = await navigator.bluetooth.getDevices();
      const d = devs.find(x => /gran/i.test(x.name || '')) || devs[0];
      if (d) await attach(d);
    } catch (e) { setState('off'); }
  }

  function feed(dv) {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    let s = '';
    for (const b of bytes) if (b >= 32 && b < 127) s += String.fromCharCode(b);
    buf += s;
    let i;
    while ((i = buf.indexOf('@')) >= 0) {
      const pkt = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      handle(pkt);
    }
    if (buf.length > 64) buf = '';
  }

  function handle(pkt) {
    if (!pkt) return;
    if (pkt === 'BTN') { onButton(); return; }
    if (pkt === 'OUT') { onHit('OUT'); return; }
    const m = pkt.match(/(\d{1,2}\.\d)$/);
    if (m && PKT[m[1]]) onHit(PKT[m[1]]);
  }

  // ---------- LED ring (Granboards with lights; ignored by JCDartz) ----------
  function send(bytes) {
    if (!wchar || !Store.settings.lights || pending > 4) return;
    pending++;
    writeQ = writeQ.then(() => wchar.writeValueWithoutResponse ? wchar.writeValueWithoutResponse(bytes) : wchar.writeValue(bytes))
      .catch(() => {}).finally(() => { pending--; });
  }
  function effect(op, colors, speed, extra) {
    const u = new Uint8Array(16);
    u[0] = op; u[15] = 1; u[12] = speed;
    (colors || []).slice(0, 3).forEach((c, i) => { u[1 + i * 3] = c[0]; u[2 + i * 3] = c[1]; u[3 + i * 3] = c[2]; });
    if (extra) extra(u);
    send(u);
  }
  const Lights = {
    ring(codes) {               // 20 color codes, one per number 1-20
      const k = codes.join('');
      if (k === lastRing) return;
      lastRing = k;
      send(new Uint8Array(codes));
    },
    off() { lastRing = ''; this.ring(new Array(20).fill(0)); },
    targets(nums, color) {
      const c = new Array(20).fill(0);
      (nums || []).forEach(n => { if (n >= 1 && n <= 20) c[n - 1] = COLOR[color || 'green']; });
      this.ring(c);
    },
    hit(d) {
      lastRing = '';
      if (!d || !d.num) { effect(0x17, [[255, 30, 20]], 6); return; }
      if (d.num === 25) { effect(0x1F, [[255, 40, 30], [40, 220, 90], [255, 255, 255]], 20, u => { u[10] = 2; u[13] = 2; }); return; }
      const col = d.mult === 3 ? [255, 170, 0] : d.mult === 2 ? [40, 230, 90] : [80, 170, 255];
      effect(d.mult, [col, [255, 255, 255]], 48, u => { u[10] = LED_ID[d.num]; u[11] = 0; });
    },
    bust() { lastRing = ''; effect(0x17, [[255, 0, 0]], 2); },
    award() { lastRing = ''; effect(0x10, [], 4); },
    win() { lastRing = ''; effect(0x0F, [], 4); },
    turn(rgb) { lastRing = ''; effect(0x11, [rgb || [143, 220, 42], [255, 255, 255]], 14, u => { u[10] = 0x10; }); },
    test() {
      const steps = [() => this.hit(Segs.parseSeg('S20I')), () => this.hit(Segs.parseSeg('D20')), () => this.hit(Segs.parseSeg('T20')),
        () => this.hit(Segs.parseSeg('DB')), () => this.turn([59, 110, 224]), () => this.award(), () => this.off()];
      steps.forEach((f, i) => setTimeout(f, i * 1400));
    },
  };

  return {
    supported, connect, autoConnect, Lights, COLOR,
    get state() { return state; }, get name() { return name; }, get canLight() { return !!wchar; },
    on(h) { onHit = h.hit || onHit; onButton = h.button || onButton; onState = h.state || onState; },
    _handle: handle, // for testing
  };
})();
window.Board = Board;
