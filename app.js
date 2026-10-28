import { DATA_URL, REFRESH_MS, ALERT_MM, normalize, summarize, filterStations, isStale } from './data.js';

const $ = id => document.getElementById(id);
const format = new Intl.NumberFormat('zh-TW', {maximumFractionDigits:1,minimumFractionDigits:1});
const integer = new Intl.NumberFormat('zh-TW');
const dateFormat = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const clockFormat = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false});
const stamp = value => Number.isFinite(Number(value)) ? dateFormat.format(Number(value)) : '未提供';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mm = value => value === null ? '—' : format.format(value);
const PAGE_SIZE = 15;
const state = {data:null, history:[], page:1, filtered:[], fetching:false, next:Date.now()+REFRESH_MS, unchangedSince:Date.now(), fetchedAt:null, error:false};

function renderSummary() {
  const {stations,latest} = state.data;
  const info = summarize(stations);
  $('max-rain').textContent = info.max ? mm(info.max.rain) : '—';
  $('max-station').textContent = info.max ? `${info.max.county} ${info.max.town} · ${info.max.name}${info.max.rain === 0 ? '（並列最高）' : ''}` : '沒有有效的 1 小時觀測';
  $('wet-count').textContent = integer.format(info.wet);
  $('alert-count').textContent = integer.format(info.alerts);
  $('valid-count').textContent = integer.format(info.valid);
  $('coverage').textContent = `共 ${integer.format(stations.length)} 站 · ${stations.length-info.valid} 站無有效 1 小時觀測`;
  $('observation-time').textContent = stamp(latest);
  $('observation-time').dateTime = new Date(latest).toISOString();
  $('fetch-time').textContent = stamp(state.fetchedAt);
  $('fetch-time').dateTime = new Date(state.fetchedAt).toISOString();
  $('rain-warning').hidden = info.alerts === 0;
  $('rain-warning').textContent = `雨量提醒｜全台 ${info.alerts} 站的 1 小時雨量達 ${ALERT_MM} mm，已在排行與測站列表標示。`;
  const chosen = $('county').value;
  $('county').innerHTML = '<option value="">全台縣市</option>' + [...new Set(stations.map(s=>s.county))].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(c=>`<option value="${escape(c)}">${escape(c)}</option>`).join('');
  if ([...$('county').options].some(o=>o.value===chosen)) $('county').value=chosen;
}

function renderFiltered() {
  if (!state.data) return;
  state.filtered = filterStations(state.data.stations,{query:$('search').value,county:$('county').value,rain:$('rain-filter').value});
  state.page = Math.min(state.page,Math.max(1,Math.ceil(state.filtered.length/PAGE_SIZE)));
  $('result-count').textContent = `${integer.format(state.filtered.length)} 站`;
  renderRanking(); renderTable();
}
function renderRanking() {
  const rows = state.filtered.filter(s=>s.rain!==null).slice(0,8);
  if (!rows.length) { $('ranking').innerHTML='<p class="empty-state">此篩選範圍沒有有效雨量觀測<br>試試其他縣市或搜尋條件</p>';return; }
  const ceiling = Math.max(1, rows[0].rain);
  $('ranking').innerHTML=rows.map((s,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><div class="rank-name" title="${escape(`${s.county} ${s.town} ${s.name}`)}">${escape(s.name)}<small>${escape(s.county+' '+s.town)}</small></div><div class="bar-track" aria-hidden="true"><div class="bar-fill ${s.rain>=ALERT_MM?'alert':''}" style="width:${s.rain/ceiling*100}%"></div></div><span class="rank-value">${mm(s.rain)}</span></div>`).join('');
}
function renderTable() {
  const offset = (state.page-1)*PAGE_SIZE;
  const rows = state.filtered.slice(offset,offset+PAGE_SIZE);
  $('station-rows').innerHTML=rows.length ? rows.map(s=>{
    const alert = s.rain!==null && s.rain>=ALERT_MM;
    const missing = s.rain===null;
    const label=alert?'雨量警示':missing?'無資料':s.rain>0?'有雨':'無降雨';
    const time=Date.parse(s.time);
    return `<tr class="${alert?'alert-row':''}"><td><span class="station-name">${escape(s.name)}</span><span class="station-location">${escape(s.county+' '+s.town)} · ${escape(s.id)}</span></td><td><span class="rain-number">${mm(s.rain)}</span></td><td class="extra-column">${mm(s.ten)}</td><td class="extra-column">${mm(s.day)}</td><td><span class="status-tag ${alert?'alert':missing?'missing':''}">${label}</span><time class="station-time">${Number.isFinite(time)?escape(stamp(time)):'未提供觀測時間'}</time></td></tr>`;
  }).join('') : '<tr><td colspan="5" class="empty-state">找不到符合條件的測站<br>請調整關鍵字或按「重設」</td></tr>';
  $('page-info').textContent=rows.length ? `${offset+1}–${offset+rows.length} / ${integer.format(state.filtered.length)} 站` : '0 站';
  $('previous').disabled=state.page<=1;
  $('next').disabled=offset+PAGE_SIZE>=state.filtered.length;
}
function renderTrend() {
  const points=state.history;
  $('history-count').textContent=`${points.length} 筆`;
  if (!points.length) return;
  const width=470,height=265,left=40,right=20,top=30,bottom=38;
  const maxY=Math.max(5,Math.ceil(Math.max(...points.map(p=>p.value))*1.15/5)*5);
  const start=points[0].at, end=points.length>1?points.at(-1).at:start+REFRESH_MS;
  const x=p=>left+(p.at-start)/Math.max(1,end-start)*(width-left-right);
  const y=value=>height-bottom-value/maxY*(height-top-bottom);
  const ticks=[0,maxY/2,maxY];
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const area=points.length>1?`<path d="${path} L${x(points.at(-1))},${height-bottom} L${left},${height-bottom} Z" fill="url(#rain-area)"/>`:'';
  const last=points.at(-1);
  const lastX=Math.min(width-right-5,Math.max(left+22,x(last)));
  $('trend').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="開啟後全台最高 1 小時雨量折線圖，共 ${points.length} 筆，最新 ${mm(last.value)} 毫米"><defs><linearGradient id="rain-area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#b5edcf" stop-opacity=".16"/><stop offset="1" stop-color="#b5edcf" stop-opacity="0"/></linearGradient></defs>${ticks.map(v=>`<line class="grid-line" x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-10}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}<text x="${left}" y="14">mm</text>${area}<path class="line" d="${path}"/>${points.map(p=>`<circle class="point" cx="${x(p)}" cy="${y(p.value)}" r="4"><title>${escape(stamp(p.at))}：${mm(p.value)} mm</title></circle>`).join('')}<text x="${lastX}" y="${Math.max(24,y(last.value)-15)}" text-anchor="middle" style="fill:#d0efdc">${mm(last.value)} mm</text><text x="${left}" y="${height-10}">${clockFormat.format(start)}</text><text x="${width-right}" y="${height-10}" text-anchor="end">${clockFormat.format(end)}</text></svg>`;
  $('trend-note').textContent=points.length===1?'已記錄第 1 筆。下次成功更新後會連成折線；不補造歷史資料。此圖不受搜尋篩選影響。':`已累積 ${points.length} 筆成功抓取紀錄（最多保留 72 筆）。此圖不受搜尋篩選影響。`;
}
function updateClocks() {
  const remaining=Math.max(0,Math.ceil((state.next-Date.now())/1000));
  $('countdown').textContent=state.fetching?'更新中':`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  if(state.data) $('stale-warning').hidden=!isStale(state.data.latest,state.unchangedSince);
  if(!state.fetching && Date.now()>=state.next) refresh();
}
async function refresh() {
  if(state.fetching) return;
  state.fetching=true;$('refresh').disabled=true;$('connection').textContent='更新中';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  try {
    // Direct browser request to the public file published by CWA, with no proxy or personal API key.
    const response=await fetch(DATA_URL,{cache:'no-store',signal:controller.signal});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=normalize(await response.json());
    const now=Date.now();
    if(!state.data || data.latest>state.data.latest) state.unchangedSince=now;
    state.data=data;state.fetchedAt=now;state.error=false;
    const info=summarize(data.stations);
    if(info.max) state.history.push({at:now,value:info.max.rain,observedAt:data.latest});
    state.history=state.history.slice(-72);
    renderSummary();renderFiltered();renderTrend();
    $('status').textContent=`已取得 ${integer.format(data.stations.length)} 個測站。畫面每 10 分鐘自動重新抓取，數字以有效的 1 小時觀測計算。`;
    $('status').classList.remove('error');
    $('connection').textContent='已連線';$('connection').classList.remove('error');
  } catch(error) {
    state.error=true;
    $('status').textContent=`更新失敗，稍後自動重試。${state.data?'保留上一次成功的資料與抓取時間。':'尚未取得成功資料，請確認網路後按「立即更新」。'}`;
    $('status').classList.add('error');
    $('connection').textContent='更新失敗';$('connection').classList.add('error');
    if(!state.data) $('station-rows').innerHTML='<tr><td colspan="5" class="empty-state">暫時無法取得資料<br>恢復連線後可立即更新，或等待自動重試</td></tr>';
  } finally {
    clearTimeout(timeout);state.fetching=false;state.next=Date.now()+REFRESH_MS;$('refresh').disabled=false;updateClocks();
  }
}
$('refresh').addEventListener('click',refresh);
for(const id of ['search','county','rain-filter']) $(id).addEventListener(id==='search'?'input':'change',()=>{state.page=1;renderFiltered();});
$('reset').addEventListener('click',()=>{$('search').value='';$('county').value='';$('rain-filter').value='all';state.page=1;renderFiltered();});
$('previous').addEventListener('click',()=>{state.page--;renderTable();});
$('next').addEventListener('click',()=>{state.page++;renderTable();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden) updateClocks();});
setInterval(updateClocks,1000);
refresh();
