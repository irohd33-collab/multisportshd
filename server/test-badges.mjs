import fs from 'fs';
if (fs.existsSync('.env')) fs.readFileSync('.env','utf8').split('\n').filter(Boolean).forEach(l=>{const [k,...v]=l.split('=');process.env[k]=v.join('=')});
const { enrichBadgesAndReferees } = await import('./badges.js');
console.time('enrich 3 maç');
const n = await enrichBadgesAndReferees({football:{events:[
  {stream_id:1,home:'Arsenal',away:'Chelsea',status:'live'},
  {stream_id:2,home:'Liverpool',away:'Everton',status:'live'},
  {stream_id:3,home:'Barcelona',away:'Real Madrid',status:'live'},
]}}, 3);
console.timeEnd('enrich 3 maç');
console.log('doldurulan:', n);
