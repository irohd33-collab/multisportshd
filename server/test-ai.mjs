import fs from 'fs';
fs.readFileSync('.env','utf8').split('\n').filter(Boolean).forEach(l=>{const [k,...v]=l.split('=');process.env[k]=v.join('=')});
const { aiOrFallbackCover } = await import('./cover-ai.js');
const e = {stream_id:'test1', home:'Galatasaray', away:'Fenerbahçe', league:'Süper Lig', sport_key:'football'};
const svg = await aiOrFallbackCover(e);
const dec = decodeURIComponent((svg.split(',')[1]||''));
console.log('fallback mı:', dec.includes('id="dots"'));
console.log('uzunluk:', dec.length);
console.log(dec.slice(0, 300));
