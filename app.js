
const CWA_FORECAST_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-093";
const IMAGES = {
  radar: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0058-002.png",
  satellite: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-B0028-002.jpg",
  rain: "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0040-002.jpg"
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const keyName = "cwa_api_key";

let lastBundle = null;

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupSettings();
  setupImages();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
  boot();
});

function setupNav(){
  const titles={home:"天氣",radar:"雷達回波",satellite:"衛星雲圖",rain:"累積雨量",typhoon:"颱風路徑",temperature:"溫度分布"};
  $$(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".nav-btn").forEach(x=>x.classList.toggle("active",x===btn));
    const target=btn.dataset.target;
    $$(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===target));
    $("#pageTitle").textContent=titles[target]||"台灣天氣";
    window.scrollTo({top:0,behavior:"smooth"});
  }));
}

function setupSettings(){
  const dlg=$("#settingsDialog"), input=$("#apiKeyInput");
  $("#settingsBtn").addEventListener("click",()=>{
    input.value=localStorage.getItem(keyName)||"";
    dlg.showModal();
  });
  $("#saveKeyBtn").addEventListener("click",(e)=>{
    e.preventDefault();
    const v=input.value.trim();
    if(v) localStorage.setItem(keyName,v); else localStorage.removeItem(keyName);
    dlg.close();
    boot();
  });
}

function setupImages(){
  const refresh=()=>{
    const t=Date.now();
    $("#radarImg").src=IMAGES.radar+"?t="+t;
    $("#satelliteImg").src=IMAGES.satellite+"?t="+t;
    $("#rainImg").src=IMAGES.rain+"?t="+t;
  };
  refresh();
  $$(".refresh-image").forEach(b=>b.addEventListener("click",refresh));
  setInterval(refresh,10*60*1000);
}

async function boot(){
  const key=localStorage.getItem(keyName)||"";
  if(!key){
    setStatus("請先按右上角 ⚙︎ 輸入中央氣象署 API 授權碼。");
    $("#settingsDialog").showModal();
    return;
  }
  setStatus("正在取得 iPhone / 瀏覽器位置…");
  try{
    const pos=await getPosition();
    setStatus("定位完成，正在讀取中央氣象署鄉鎮預報…");
    const data=await fetchCWA(key);
    const locations=flattenLocations(data);
    if(!locations.length) throw new Error("API 已回應，但找不到鄉鎮預報資料。");
    const nearest=findNearest(locations,pos.coords.latitude,pos.coords.longitude);
    if(!nearest) throw new Error("無法由氣象署資料判斷所在地。");
    $("#placeName").textContent=nearest.city ? `${nearest.city} ${nearest.name}` : nearest.name;
    lastBundle=parseForecast(nearest.raw);
    render(lastBundle);
    setStatus(`資料來源：交通部中央氣象署 F-D0047-093\n定位：${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}；最近預報代表點：約 ${nearest.distance.toFixed(1)} km`);
  }catch(err){
    console.error(err);
    setStatus("載入失敗："+(err?.message||err)+"\n若是 API 讀取失敗，請確認授權碼及網站是否透過 HTTPS 開啟。");
  }
}

function getPosition(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error("此瀏覽器不支援定位。"));
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:10*60*1000});
  });
}

async function fetchCWA(key){
  const u=new URL(CWA_FORECAST_URL);
  u.searchParams.set("Authorization",key);
  u.searchParams.set("format","JSON");
  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok) throw new Error(`中央氣象署 API HTTP ${r.status}`);
  const data=await r.json();
  if(String(data.success).toLowerCase()==="false") throw new Error(data.message||"中央氣象署 API 回傳失敗");
  return data;
}

function flattenLocations(root){
  const out=[];
  function walk(node,cityHint=""){
    if(Array.isArray(node)){ node.forEach(x=>walk(x,cityHint)); return; }
    if(!node||typeof node!=="object") return;
    const city=node.LocationsName||node.locationsName||node.locationName&&node.WeatherElement?cityHint:"";
    const name=node.LocationName||node.locationName;
    const lat=num(node.Latitude??node.latitude);
    const lon=num(node.Longitude??node.longitude);
    const elems=node.WeatherElement||node.weatherElement;
    if(name&&Number.isFinite(lat)&&Number.isFinite(lon)&&elems){
      out.push({name,city:cityHint||"",lat,lon,raw:node});
    }
    Object.entries(node).forEach(([k,v])=>{
      let next=cityHint;
      if(k==="LocationsName"||k==="locationsName") next=String(v);
      if(typeof v==="object") walk(v,next);
    });
  }
  walk(root,"");
  const seen=new Set();
  return out.filter(x=>{
    const k=`${x.name}|${x.lat}|${x.lon}`;
    if(seen.has(k)) return false; seen.add(k); return true;
  });
}

function findNearest(list,lat,lon){
  let best=null;
  for(const x of list){
    const d=haversine(lat,lon,x.lat,x.lon);
    if(!best||d<best.distance) best={...x,distance:d};
  }
  return best;
}
function haversine(a,b,c,d){
  const R=6371, rad=x=>x*Math.PI/180;
  const dLat=rad(c-a), dLon=rad(d-b);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}
function num(v){ const n=Number(v); return Number.isFinite(n)?n:NaN; }

function parseForecast(loc){
  const elems=loc.WeatherElement||loc.weatherElement||[];
  const map=new Map();
  for(const e of elems){
    const n=e.ElementName||e.elementName||e.Description||e.description||"";
    const times=e.Time||e.time||[];
    map.set(n,Array.isArray(times)?times:[times]);
  }
  const get=(names)=>{ for(const n of names) if(map.has(n)) return map.get(n); return []; };
  const T=get(["溫度","T","平均溫度"]);
  const AT=get(["體感溫度","AT","平均體感溫度"]);
  const RH=get(["相對濕度","RH","平均相對濕度"]);
  const WX=get(["天氣現象","Wx"]);
  const POP=get(["3小時降雨機率","12小時降雨機率","PoP","PoP12h","PoP6h"]);
  const WIND=get(["風速","Wind","風向"]);
  const MAX=get(["最高溫度","MaxT"]);
  const MIN=get(["最低溫度","MinT"]);
  const now=new Date();

  const currentT=valueAt(T,now);
  const currentAT=valueAt(AT,now);
  const currentRH=valueAt(RH,now);
  const currentWX=weatherAt(WX,now);
  const currentPOP=valueAt(POP,now);
  const currentWind=windAt(WIND,now);

  const hours=[];
  for(const item of T){
    const dt=timeOf(item);
    if(!dt||dt<new Date(now.getTime()-3*3600e3)) continue;
    hours.push({
      time:dt,
      temp:valueFrom(item),
      at:nearestValue(AT,dt),
      rh:nearestValue(RH,dt),
      pop:nearestValue(POP,dt),
      wx:nearestWeather(WX,dt),
      wind:nearestWind(WIND,dt)
    });
    if(hours.length>=9) break;
  }

  const days=[];
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  for(let i=0;i<5;i++){
    const d0=new Date(start); d0.setDate(d0.getDate()+i);
    const d1=new Date(d0); d1.setDate(d1.getDate()+1);
    const ts=valuesInDay(T,d0,d1);
    const mx=valuesInDay(MAX,d0,d1);
    const mn=valuesInDay(MIN,d0,d1);
    const pops=valuesInDay(POP,d0,d1);
    days.push({
      date:d0,
      max:mx.length?Math.max(...mx):(ts.length?Math.max(...ts):null),
      min:mn.length?Math.min(...mn):(ts.length?Math.min(...ts):null),
      pop:pops.length?Math.max(...pops):null,
      wx:weatherInDay(WX,d0,d1)
    });
  }
  return {currentT,currentAT,currentRH,currentWX,currentPOP,currentWind,hours,days};
}

function timeOf(item){
  const s=item.DataTime||item.dataTime||item.StartTime||item.startTime||item.Date||item.date;
  if(!s) return null;
  const d=new Date(s); return isNaN(d)?null:d;
}
function endOf(item){ const s=item.EndTime||item.endTime; if(!s)return null; const d=new Date(s); return isNaN(d)?null:d; }
function values(item){
  const v=item.ElementValue||item.elementValue||[];
  return Array.isArray(v)?v:[v];
}
function valueFrom(item){
  for(const v of values(item)){
    for(const k of ["Temperature","ApparentTemperature","RelativeHumidity","ProbabilityOfPrecipitation","WindSpeed","MaxTemperature","MinTemperature","Value","value"]){
      if(v&&v[k]!=null&&Number.isFinite(Number(v[k]))) return Number(v[k]);
    }
  }
  return null;
}
function weatherFrom(item){
  for(const v of values(item)){
    if(!v) continue;
    const text=v.Weather??v.WeatherDescription??v.value??v.Value??null;
    const code=Number(v.WeatherCode??v.weatherCode);
    if(text!=null||Number.isFinite(code)) return {text:text?String(text):"",code:Number.isFinite(code)?code:null};
  }
  return {text:"",code:null};
}
function windFrom(item){
  for(const v of values(item)){
    if(!v) continue;
    const speed=Number(v.WindSpeed??v.windSpeed);
    const dir=v.WindDirection??v.windDirection??"";
    if(Number.isFinite(speed)||dir) return {speed:Number.isFinite(speed)?speed:null,dir:String(dir||"")};
  }
  return {speed:null,dir:""};
}
function contains(item,date){
  const s=timeOf(item); if(!s)return false;
  const e=endOf(item)||new Date(s.getTime()+3*3600e3);
  return date>=s&&date<e;
}
function valueAt(list,date){
  const hit=list.find(x=>contains(x,date));
  return hit?valueFrom(hit):nearestValue(list,date);
}
function weatherAt(list,date){
  const hit=list.find(x=>contains(x,date));
  return hit?weatherFrom(hit):nearestWeather(list,date);
}
function windAt(list,date){
  const hit=list.find(x=>contains(x,date));
  return hit?windFrom(hit):nearestWind(list,date);
}
function nearest(list,date,extract){
  let best=null;
  for(const x of list){
    const t=timeOf(x); if(!t)continue;
    const diff=Math.abs(t-date);
    if(!best||diff<best.diff) best={diff,val:extract(x)};
  }
  return best?best.val:null;
}
const nearestValue=(l,d)=>nearest(l,d,valueFrom);
const nearestWeather=(l,d)=>nearest(l,d,weatherFrom)||{text:"",code:null};
const nearestWind=(l,d)=>nearest(l,d,windFrom)||{speed:null,dir:""};
function valuesInDay(list,a,b){return list.filter(x=>{const t=timeOf(x);return t&&t>=a&&t<b}).map(valueFrom).filter(Number.isFinite)}
function weatherInDay(list,a,b){
  const x=list.find(x=>{const t=timeOf(x);return t&&t>=a&&t<b});
  return x?weatherFrom(x):{text:"",code:null};
}

function render(w){
  $("#currentTemp").textContent=fmtTemp(w.currentT);
  $("#currentWeather").textContent=w.currentWX?.text||"天氣";
  $("#currentIcon").textContent=weatherEmoji(w.currentWX?.text,w.currentWX?.code);
  const d0=w.days[0]||{};
  $("#todayRange").textContent=`最高 ${fmtTemp(d0.max)}　最低 ${fmtTemp(d0.min)}`;
  $("#humidity").textContent=fmtPct(w.currentRH);
  $("#apparent").textContent=fmtTemp(w.currentAT);
  $("#wind").textContent=w.currentWind?.speed!=null?`${Math.round(w.currentWind.speed*3.6)} km/h`:"--";
  $("#pop").textContent=fmtPct(w.currentPOP);

  $("#fiveDays").classList.remove("empty");
  $("#fiveDays").innerHTML=w.days.map((d,i)=>`
    <div class="day-row">
      <strong>${dayLabel(d.date,i)}</strong>
      <div class="day-icon">${weatherEmoji(d.wx?.text,d.wx?.code)}</div>
      <div class="rain">${d.pop==null?"--":Math.round(d.pop)+"%"}</div>
      <div class="rangebar"></div>
      <div>${fmtTemp(d.max)}</div>
    </div>`).join("");

  $("#hourly").innerHTML=w.hours.length?w.hours.map((h,i)=>`
    <div class="hour-item">
      <div class="hour-time">${i===0?"現在":h.time.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",hour12:false})}</div>
      <div class="hour-temp">${fmtTemp(h.temp)}</div>
      <div class="hour-icon">${weatherEmoji(h.wx?.text,h.wx?.code,isNight(h.time))}</div>
      <div class="hour-rain">${h.pop==null?"--":Math.round(h.pop)+"%"}</div>
      <div class="hour-wind">${h.wind?.speed!=null?Math.round(h.wind.speed*3.6)+" km/h":"--"}</div>
    </div>`).join(""):`<div class="empty">尚無逐時資料</div>`;
}
function fmtTemp(v){return Number.isFinite(v)?Math.round(v)+"°":"--°"}
function fmtPct(v){return Number.isFinite(v)?Math.round(v)+"%":"--"}
function dayLabel(d,i){
  if(i===0)return"今天"; if(i===1)return"明天";
  return ["日","一","二","三","四","五","六"][d.getDay()];
}
function isNight(d){const h=d.getHours();return h<6||h>=18}
function weatherEmoji(text="",code=null,night=false){
  text=String(text||"");
  if(text.includes("雷"))return"⛈️";
  if(text.includes("雨"))return"🌧️";
  if(text.includes("霧"))return"🌫️";
  if(text.includes("陰"))return"☁️";
  if(text.includes("多雲"))return night?"☁️":"⛅";
  if(text.includes("晴"))return night?"🌙":"☀️";
  if(code===1)return night?"🌙":"☀️";
  return"☁️";
}
function setStatus(t){$("#status").textContent=t}
