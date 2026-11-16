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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Patrick+Hand&display=swap">
<style>
  html,body,#map{margin:0;height:100%;background:#FFF6E0}
  /* deixa o mapa com cara de papel envelhecido */
  .leaflet-tile-pane{filter:sepia(.45) saturate(1.15) hue-rotate(-8deg) brightness(1.04) contrast(.95)}
  .pin{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);}
  .pin .dot{width:42px;height:42px;border:3px solid #1F1A17;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
    font:400 21px 'Luckiest Guy',sans-serif;padding-top:3px;box-shadow:3px 3px 0 #1F1A17;
    border-radius:52% 48% 55% 45% / 48% 55% 45% 52%}
  .pin .lbl{margin-top:5px;background:#1F1A17;color:#FFF6E0;font:400 15px 'Patrick Hand',sans-serif;padding:0 9px;border-radius:9px;white-space:nowrap}
  .pin.me .dot{width:50px;height:50px;font-size:25px}
  .pin.old .dot{filter:grayscale(.6);opacity:.65}
  .pin.tilt-l .lbl{transform:rotate(-3deg)} .pin.tilt-r .lbl{transform:rotate(2deg)}
  .leaflet-div-icon{background:none;border:none}
  .leaflet-control-attribution{font:12px 'Patrick Hand',sans-serif;background:rgba(255,246,224,.85)!important}
</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([-23.55, -46.63], 12);
  // Mapa principal: OpenStreetMap (sem chave). Se falhar, troca sozinho pro mapa da Esri.
  var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  });
  var esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: '&copy; Esri, OpenStreetMap'
  });
  var okTiles = 0, badTiles = 0, switched = false;
  osm.on('tileload', function(){ okTiles++; });
  osm.on('tileerror', function(){
    badTiles++;
    if (!switched && badTiles >= 4 && okTiles === 0) { switched = true; map.removeLayer(osm); esri.addTo(map); }
  });
  osm.addTo(map);
  var layer = L.layerGroup().addTo(map);
  var lastBounds = null, fittedOnce = false;

  function ago(iso){
    var s = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
    if (s < 90) return 'agora';
    if (s < 3600) return Math.round(s/60) + ' min';
    if (s < 86400) return Math.round(s/3600) + ' h';
    return Math.round(s/86400) + ' d';
  }
  function inkOn(hex){ var n=parseInt(String(hex).replace('#',''),16); var l=.299*((n>>16)&255)+.587*((n>>8)&255)+.114*(n&255); return l>150?'#1F1A17':'#FFF6E0'; }
  function esc(t){ return String(t).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  window.update = function(d){
    layer.clearLayers();
    var pts = [];
    (d.trails||[]).forEach(function(t){
      t.segments.forEach(function(seg){
        if (seg.length > 1) {
          L.polyline(seg, { color: '#1F1A17', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round', dashArray: '1 13' }).addTo(layer);
          L.polyline(seg, { color: t.color, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round', dashArray: '1 13' }).addTo(layer);
        }
        seg.forEach(function(p){ pts.push(p); });
      });
    });
    (d.people||[]).forEach(function(p, i){
      var old = (Date.now() - new Date(p.at).getTime()) > 15*60*1000;
      var cls = 'pin' + (old?' old':'') + (p.me?' me':'') + (i%2?' tilt-r':' tilt-l');
      var html = '<div class="'+cls+'"><div class="dot" style="background:'+esc(p.color)+';color:'+inkOn(p.color)+'">'+esc((p.name||'?').charAt(0).toUpperCase())+'</div>'+
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
      androidLayerType="hardware"
      originWhitelist={['*']}
      source={{ html: HTML, baseUrl: 'https://macacadas.map/' }}
      onMessage={(e: WebViewMessageEvent) => e.nativeEvent.data === 'ready' && setReady(true)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
});

const styles = StyleSheet.create({ map: { flex: 1, backgroundColor: '#FFF6E0' } });

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
