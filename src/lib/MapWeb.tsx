import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';

// Contorno de tipagem do WebView com os tipos do React 19
const WV = WebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebView> }>;

export type MapPerson = {
  id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  at: string; // ISO
  me?: boolean;
};

export type MapTrail = {
  id: string;
  color: string;
  segments: [number, number][][]; // vários trechos (quebra quando há buraco de tempo)
};

export type MapData = { people: MapPerson[]; trails: MapTrail[] };

export type MapHandle = { fit: () => void; focus: (lat: number, lng: number) => void };

const HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;height:100%;background:#1b1b1b}
  .pin{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);}
  .pin .dot{width:38px;height:38px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;
    font:700 16px sans-serif;color:#111;box-shadow:0 2px 6px rgba(0,0,0,.5)}
  .pin .lbl{margin-top:3px;background:rgba(0,0,0,.75);color:#fff;font:600 11px sans-serif;padding:2px 6px;border-radius:8px;white-space:nowrap}
  .pin.old .dot{opacity:.55}
  .leaflet-div-icon{background:none;border:none}
</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-23.55, -46.63], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var lastBounds = null, fittedOnce = false;

  function ago(iso){
    var s = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
    if (s < 90) return 'agora';
    if (s < 3600) return Math.round(s/60) + ' min';
    if (s < 86400) return Math.round(s/3600) + ' h';
    return Math.round(s/86400) + ' d';
  }
  function esc(t){ return String(t).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  window.update = function(d){
    layer.clearLayers();
    var pts = [];
    (d.trails||[]).forEach(function(t){
      t.segments.forEach(function(seg){
        if (seg.length > 1) {
          L.polyline(seg, { color: '#000', weight: 7, opacity: .25 }).addTo(layer);
          L.polyline(seg, { color: t.color, weight: 4, opacity: .9 }).addTo(layer);
        }
        seg.forEach(function(p){ pts.push(p); });
      });
    });
    (d.people||[]).forEach(function(p){
      var old = (Date.now() - new Date(p.at).getTime()) > 15*60*1000;
      var html = '<div class="pin'+(old?' old':'')+'"><div class="dot" style="background:'+esc(p.color)+'">'+esc((p.name||'?').charAt(0).toUpperCase())+'</div>'+
                 '<div class="lbl">'+esc(p.me ? 'Você' : p.name)+' · '+ago(p.at)+'</div></div>';
      L.marker([p.lat, p.lng], { icon: L.divIcon({ html: html, iconSize: [0,0] }), zIndexOffset: p.me ? 1000 : 0 }).addTo(layer);
      pts.push([p.lat, p.lng]);
    });
    lastBounds = pts.length ? L.latLngBounds(pts) : null;
    if (!fittedOnce && lastBounds) { window.fit(); fittedOnce = true; }
  };
  window.fit = function(){ if (lastBounds) map.fitBounds(lastBounds.pad(0.2), { maxZoom: 17 }); };
  window.focusOn = function(lat,lng){ map.setView([lat,lng], 17); };
  window.resetFit = function(){ fittedOnce = false; };
  window.ReactNativeWebView.postMessage('ready');
</script></body></html>`;

type Props = { data: MapData; resetKey?: string };

export const MapWeb = forwardRef<MapHandle, Props>(function MapWeb({ data, resetKey }, ref) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    fit: () => web.current?.injectJavaScript('window.fit(); true;'),
    focus: (lat, lng) => web.current?.injectJavaScript(`window.focusOn(${lat},${lng}); true;`),
  }));

  useEffect(() => {
    if (ready) web.current?.injectJavaScript('window.resetFit(); true;');
  }, [resetKey, ready]);

  useEffect(() => {
    if (!ready) return;
    web.current?.injectJavaScript(`window.update(${JSON.stringify(data)}); true;`);
  }, [data, ready]);

  return (
    <WV
      ref={web}
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: HTML, baseUrl: 'https://macacadas.map/' }}
      onMessage={(e: WebViewMessageEvent) => e.nativeEvent.data === 'ready' && setReady(true)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
});

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: '#1b1b1b' } });

/** Transforma pontos em trechos, quebrando quando passa mais de 15 min entre um e outro. */
export function toSegments(points: { lat: number; lng: number; recorded_at: string }[]): [number, number][][] {
  const segs: [number, number][][] = [];
  let cur: [number, number][] = [];
  let last = 0;
  for (const p of points) {
    const t = new Date(p.recorded_at).getTime();
    if (cur.length && t - last > 15 * 60 * 1000) {
      segs.push(cur);
      cur = [];
    }
    cur.push([p.lat, p.lng]);
    last = t;
  }
  if (cur.length) segs.push(cur);
  return segs;
}
