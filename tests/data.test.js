import test from 'node:test';
import assert from 'node:assert/strict';
import {rainValue,normalize,summarize,filterStations,isStale,STALE_MS} from '../data.js';

test('missing and negative sentinel rainfall never become measured zero',()=>{
  for(const v of [null,undefined,'', '  ', '-99','-999','-998','x']) assert.equal(rainValue(v),null);
  assert.equal(rainValue('0.0'),0);assert.equal(rainValue('40.5'),40.5);
});
const rows=[{id:'a',name:'山頂',county:'臺北市',town:'北投區',rain:40},{id:'b',name:'山下',county:'新北市',town:'新店區',rain:0},{id:'c',name:'缺測',county:'臺北市',town:'北投區',rain:null},{id:'d',name:'山腰',county:'新北市',town:'新店區',rain:39.5}];
test('40 mm inclusive alert threshold and missing observations excluded',()=>{
  const s=summarize(rows);assert.equal(s.valid,3);assert.equal(s.wet,2);assert.equal(s.alerts,1);assert.equal(s.max.id,'a');
});
test('combined filters and sort retain the requested region and missing state',()=>{
  assert.deepEqual(filterStations(rows,{county:'新北市',query:'新店',rain:'wet'}).map(s=>s.id),['d']);
  assert.deepEqual(filterStations(rows,{rain:'alert'}).map(s=>s.id),['a']);
  assert.deepEqual(filterStations(rows,{rain:'missing'}).map(s=>s.id),['c']);
  assert.deepEqual(filterStations(rows).map(s=>s.id),['a','d','b','c']);
});
test('normalizes official file and API envelopes with per-station observation time',()=>{
  const Station=[{StationName:'測站',StationId:'01',GeoInfo:{CountyName:'南投縣'},ObsTime:{DateTime:'2026-10-28T14:50:00+08:00'},RainfallElement:{Past1hr:{Precipitation:'41'},Past10Min:{Precipitation:'-99'}}}];
  for(const p of [{cwaopendata:{dataset:{Station}}},{records:{Station}}]){
    const d=normalize(p);assert.equal(d.stations[0].rain,41);assert.equal(d.stations[0].ten,null);assert.equal(d.latest,Date.parse(Station[0].ObsTime.DateTime));
  }
  assert.throws(()=>normalize({cwaopendata:{dataset:{Station:[]}}}));
});
test('delay warning checks observation age and unchanged data time separately',()=>{
  const now=2000000000;
  assert.equal(isStale(now-1000,now-1000,now),false);
  assert.equal(isStale(now-STALE_MS-1,now,now),true);
  assert.equal(isStale(now,now-STALE_MS-1,now),true);
});
