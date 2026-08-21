// 锂电产业链A股存货库存 JS v5 - reclassified: upstream=all carbonate producers, midstream=cathode+electrolyte+anode, downstream=battery
const COLORS={upstream:'#66bb6a',midstream:'#42a5f5',downstream_pos:'#ffa726',downstream_bat:'#ef5350',bg:'#1e1e1e',grid:'#333',text:'#e0e0e0',axis:'#666'};
const SECTOR_COLORS={'上游-锂矿/盐湖':COLORS.upstream,'上游-锂盐加工':COLORS.upstream,'中游-正极材料':COLORS.midstream,'中游-电解液':COLORS.midstream,'中游-电解液辅材':COLORS.midstream,'中游-负极材料':COLORS.midstream,'下游-电池':COLORS.downstream_bat};
function sectorClass(s){return s.includes('上游')?'upstream':s.includes('中游')?'midstream':'downstream'}
function fmtB(v){return(v/1e8).toFixed(2)+'亿'}
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{if((e.ctrlKey&&['c','s','p'].includes(e.key))||e.key==='F12')e.preventDefault()});
document.addEventListener('selectstart',e=>e.preventDefault());
const dk={backgroundColor:'transparent',textStyle:{color:COLORS.text},grid:{left:60,right:30,top:40,bottom:40},
xAxis:{axisLine:{lineStyle:{color:COLORS.axis}},axisLabel:{color:COLORS.axis}},
yAxis:{axisLine:{lineStyle:{color:COLORS.axis}},axisLabel:{color:COLORS.axis},splitLine:{lineStyle:{color:'#2a2a2a'}}},
tooltip:{backgroundColor:'#333',borderColor:'#555',textStyle:{color:'#e0e0e0'}},legend:{textStyle:{color:COLORS.text}}};
let gCo=[],gTr=[],gSec={},gLat=[],gRatio=[];
let trendSector='全部',ratioSector='全部',tableSector='全部';
let trendSel=new Set(),ratioSel=new Set();
// Chart instances - dispose before re-init to avoid stale series
let charts={};
function getChart(id){if(charts[id])charts[id].dispose();return echarts.init(document.getElementById(id));}
async function loadAll(){try{
[gCo,gTr,gSec,gLat,gRatio]=await Promise.all([
fetch('/api/lithium_inv/companies').then(r=>r.json()),
fetch('/api/lithium_inv/trends?from=20180101').then(r=>r.json()),
fetch('/api/lithium_inv/sector_summary?from=20180101').then(r=>r.json()),
fetch('/api/lithium_inv/latest_compare').then(r=>r.json()),
fetch('/api/lithium_inv/inv_sales_ratio?from=20180101').then(r=>r.json())
]);
gCo.forEach(c=>{trendSel.add(c.ticker);ratioSel.add(c.ticker)});
initSubTabs();populateChips();renderAll()
}catch(e){console.error(e)}}
function filteredCos(sec){
  if(sec==='全部')return gCo;
  return gCo.filter(c=>{
    if(!c.sector && !c.industry_chain) return false;
    return (c.sector&&c.sector.startsWith(sec))||(c.industry_chain===sec)
  })
}
function initSubTabs(){
  ['trendSubTabs','ratioSubTabs','tableSubTabs'].forEach(tabId=>{
    document.querySelectorAll(`#${tabId} .sub-tab`).forEach(tab=>{
      tab.addEventListener('click',()=>{
        try{
          document.querySelectorAll(`#${tabId} .sub-tab`).forEach(t=>t.classList.remove('active'));
          tab.classList.add('active');
          const sec=tab.dataset.sector;
          const fc=filteredCos(sec);
          console.log(`[Tab] ${tabId} -> ${sec}, filtered ${fc.length} companies`, fc.map(c=>`${c.ticker}(${c.sector})`));
          if(tabId==='trendSubTabs'){trendSector=sec;trendSel.clear();fc.forEach(c=>trendSel.add(c.ticker))}
          else if(tabId==='ratioSubTabs'){ratioSector=sec;ratioSel.clear();fc.forEach(c=>ratioSel.add(c.ticker))}
          else{tableSector=sec}
          populateChips();renderAll()
        }catch(e){console.error('[Tab] click handler error:',e)}
      })
    })
  });
  // Quarter filter tabs for ratio chart
  document.querySelectorAll('#ratioQuarterTabs .quarter-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('#ratioQuarterTabs .quarter-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      ratioQuarter=tab.dataset.quarter;
      console.log(`[Quarter] ratioQuarter -> ${ratioQuarter}`);
      renderAll()
    })
  })
}
function populateChips(){
  const tc=filteredCos(trendSector),rc=filteredCos(ratioSector);
  const tw=document.getElementById('trendChips');tw.innerHTML='';
  tc.forEach(c=>{const ch=document.createElement('span');ch.className='chip selected';
    ch.dataset.ticker=c.ticker;ch.dataset.sector=c.sector;
    ch.textContent=c.ticker+' '+c.name;
    ch.addEventListener('click',()=>{ch.classList.toggle('selected');
      if(trendSel.has(c.ticker))trendSel.delete(c.ticker);else trendSel.add(c.ticker);renderAll()});
    tw.appendChild(ch)});
  const rw=document.getElementById('ratioChips');rw.innerHTML='';
  rc.forEach(c=>{const ch=document.createElement('span');ch.className='chip selected';
    ch.dataset.ticker=c.ticker;ch.dataset.sector=c.sector;
    ch.textContent=c.ticker+' '+c.name;
    ch.addEventListener('click',()=>{ch.classList.toggle('selected');
      if(ratioSel.has(c.ticker))ratioSel.delete(c.ticker);else ratioSel.add(c.ticker);renderAll()});
    rw.appendChild(ch)})
}
function renderAll(){rSector();rInvAsset();rInvCurr();rBar();rTrend();rRatio();rTable()}

// ── 板块汇总图表 (固定全部数据) ──
function rSector(){
  const ch=getChart('chartSectorTrend');charts['chartSectorTrend']=ch;
  const ds=(gSec.dates||[]).slice().sort((a,b)=>a-b); // 数字升序，左旧→右新
  const sc=gSec.sectors||{},ns=Object.keys(sc);
  ch.setOption({...dk,tooltip:{...dk.tooltip,trigger:'axis',axisPointer:{type:'shadow'},
    formatter:p=>{let s='<b>'+p[0].name+'</b><br/>';p.forEach(i=>s+=i.marker+' '+i.seriesName+': '+fmtB(i.value)+'<br/>');return s}},
  legend:{data:ns,top:5},xAxis:{...dk.xAxis,type:'category',data:ds,inverse:false},
  yAxis:{...dk.yAxis,name:'亿元',nameTextStyle:{color:COLORS.axis}},
  series:ns.map(n=>({name:n,type:'bar',stack:'inv',barWidth:'60%',
    color:SECTOR_COLORS[n]||'#888',data:sc[n].inv}))});
}
function rInvAsset(){
  const ch=getChart('chartInvAsset');charts['chartInvAsset']=ch;
  const ds=(gSec.dates||[]).slice().sort((a,b)=>a-b); // 数字升序，左旧→右新
  const sc=gSec.sectors||{},ns=Object.keys(sc);
  ch.setOption({...dk,tooltip:{...dk.tooltip,trigger:'axis',
    formatter:p=>{let s='<b>'+p[0].name+'</b><br/>';p.forEach(i=>s+=i.marker+' '+i.seriesName+': '+i.value.toFixed(1)+'%<br/>');return s}},
  legend:{data:ns,top:5},xAxis:{...dk.xAxis,type:'category',data:ds,inverse:false},
  yAxis:{...dk.yAxis,name:'%',nameTextStyle:{color:COLORS.axis},axisLabel:{formatter:'{value}%'}},
  series:ns.map(n=>({name:n,type:'line',smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:2},
    color:SECTOR_COLORS[n]||'#888',data:sc[n].inv_asset_pct}))});
}
function rInvCurr(){
  const ch=getChart('chartInvCurrent');charts['chartInvCurrent']=ch;
  const ds=(gSec.dates||[]).slice().sort((a,b)=>a-b); // 数字升序，左旧→右新
  const sc=gSec.sectors||{},ns=Object.keys(sc);
  ch.setOption({...dk,tooltip:{...dk.tooltip,trigger:'axis',
    formatter:p=>{let s='<b>'+p[0].name+'</b><br/>';p.forEach(i=>s+=i.marker+' '+i.seriesName+': '+i.value.toFixed(1)+'%<br/>');return s}},
  legend:{data:ns,top:5},xAxis:{...dk.xAxis,type:'category',data:ds,inverse:false},
  yAxis:{...dk.yAxis,name:'%',nameTextStyle:{color:COLORS.axis},axisLabel:{formatter:'{value}%'}},
  series:ns.map(n=>({name:n,type:'line',smooth:true,symbol:'circle',symbolSize:6,lineStyle:{width:2},
    color:SECTOR_COLORS[n]||'#888',data:sc[n].inv_current_pct}))});
}

// ── 公司存货排名 ──
function rBar(){
  const ch=getChart('chartCompanyBar');charts['chartCompanyBar']=ch;
  const sorted=[...gLat].sort((a,b)=>b.inventory_yuan-a.inventory_yuan);
  if(!sorted.length)return;
  const nm=sorted.map(c=>c.ticker+' '+c.name),vl=sorted.map(c=>c.inventory_yuan);
  const cl=sorted.map(c=>SECTOR_COLORS[c.sector]||'#888');
  ch.setOption({...dk,grid:{left:160,right:80,top:10,bottom:10},
    tooltip:{...dk.tooltip,trigger:'axis',axisPointer:{type:'shadow'},
      formatter:p=>p[0].name+': '+fmtB(p[0].value)},
    xAxis:{...dk.xAxis,type:'value',name:'亿元',nameTextStyle:{color:COLORS.axis}},
    yAxis:{...dk.yAxis,type:'category',data:nm.reverse(),axisLabel:{color:COLORS.text,fontSize:11}},
    series:[{type:'bar',barWidth:'60%',data:vl.reverse().map((v,i)=>({value:v,itemStyle:{color:cl[i]}})),
      label:{show:true,position:'right',color:COLORS.text,fontSize:11,formatter:p=>fmtB(p.value)}}]});
}

// ── 个股存货趋势 (按上/中/下游切换，2018+全量) ──
function rTrend(){
  const fc=filteredCos(trendSector);
  const tk=[...trendSel].filter(t=>fc.find(c=>c.ticker===t));
  document.getElementById('trendBadge').textContent=(trendSector==='全部'?'全部':trendSector)+' | '+tk.length+'家';
  const ch=getChart('chartCompanyTrend');charts['chartCompanyTrend']=ch;
  const it=gTr.filter(t=>tk.includes(t.ticker));
  if(!it.length){ch.clear();return}
  const ds=[...new Set(it.flatMap(i=>i.quarters.map(q=>q.date)))].sort();
  ch.setOption({
    ...dk,grid:{left:70,right:30,top:50,bottom:40},
    tooltip:{...dk.tooltip,trigger:'axis',
      formatter:p=>{let s='<b>'+p[0].name+'</b><br/>';p.forEach(i=>s+=i.marker+' '+i.seriesName+': '+fmtB(i.value)+'<br/>');return s}},
    legend:{type:'scroll',data:it.map(i=>i.ticker+' '+i.name),top:5,textStyle:{fontSize:11}},
    xAxis:{...dk.xAxis,type:'category',data:ds,axisLabel:{rotate:30,interval:Math.floor(ds.length/12)}},
    yAxis:{...dk.yAxis,name:'亿元',nameTextStyle:{color:COLORS.axis}},
    series:it.map(item=>{const v={};item.quarters.forEach(q=>v[q.date]=q.inventory_yuan);
      return{name:item.ticker+' '+item.name,type:'line',smooth:true,symbol:'circle',symbolSize:5,
        lineStyle:{width:2},color:SECTOR_COLORS[item.sector]||'#888',data:ds.map(d=>v[d]??null)}})
  },{notMerge:true,replaceLayout:true});
}

// ── 库销比异常值过滤规则 ──
const RATIO_CAP=10;
function safeRatio(v){return v!=null&&v>0&&v<RATIO_CAP?+v.toFixed(2):null}

// ── 库销比季度过滤 (去除季节性影响) ──
let ratioQuarter='全部'; // 全部 / Q1 / Q2 / Q3 / Q4
function isQuarter(dateStr, quarter){
  if(quarter==='全部')return true;
  const month=parseInt(dateStr.substring(4,6),10);
  const q=Math.ceil(month/3);
  return 'Q'+q===quarter
}

// ── 个股库销比趋势 (按上/中/下游切换，2018+全量) ──
function rRatio(){
  const fc=filteredCos(ratioSector);
  const tk=[...ratioSel].filter(t=>fc.find(c=>c.ticker===t));
  document.getElementById('ratioBadge').textContent=(ratioSector==='全部'?'全部':ratioSector)+' | '+tk.length+'家'+(ratioQuarter!=='全部'?` (${ratioQuarter})`:'');
  const ch=getChart('chartInvSalesRatio');charts['chartInvSalesRatio']=ch;
  const it=gRatio.filter(t=>tk.includes(t.ticker));
  if(!it.length){ch.clear();return}
  // 只保留匹配季度的数据点
  const ds=[...new Set(it.flatMap(i=>i.quarters.filter(q=>isQuarter(q.date,ratioQuarter)).map(q=>q.date)))].sort();
  if(!ds.length){ch.clear();return}
  ch.setOption({
    ...dk,grid:{left:70,right:30,top:50,bottom:40},
    tooltip:{...dk.tooltip,trigger:'axis',
      formatter:p=>{let s='<b>'+p[0].name+'</b><br/>';p.forEach(i=>{
        if(i.value==null)s+=i.marker+' '+i.seriesName+': N/A<br/>';
        else s+=i.marker+' '+i.seriesName+': '+i.value.toFixed(2)+'<br/>';
      });return s}},
    legend:{type:'scroll',data:it.map(i=>i.ticker+' '+i.name),top:5,textStyle:{fontSize:11}},
    xAxis:{...dk.xAxis,type:'category',data:ds,axisLabel:{rotate:30,interval:Math.floor(ds.length/12)}},
    yAxis:{...dk.yAxis,name:'库销比',nameTextStyle:{color:COLORS.axis}},
    series:it.map(item=>{const v={};item.quarters.filter(q=>isQuarter(q.date,ratioQuarter)).forEach(q=>v[q.date]=q.inv_to_revenue_ratio);
      return{name:item.ticker+' '+item.name,type:'line',smooth:true,symbol:'circle',symbolSize:5,
        lineStyle:{width:2},color:SECTOR_COLORS[item.sector]||'#888',
        data:ds.map(d=>safeRatio(v[d]))}}),
    graphic:[{type:'text',left:'center',top:38,style:{
      text:`>1: 偏高 | 0.5-1: 适中 | <0.5: 偏低 | >${RATIO_CAP}: 异常隐藏`,fill:'#888',fontSize:11}}]
  },{notMerge:true,replaceLayout:true});
}

// ── 数据明细表格 (按上/中/下游切换) ──
function rTable(){
  const fc=filteredCos(tableSector);
  const tb=document.querySelector('#dataTable tbody');
  tb.innerHTML='';
  [...gLat].filter(c=>fc.find(f=>f.ticker===c.ticker)).forEach(c=>{
    const tr=document.createElement('tr');
    const rawRatio=c.inv_to_revenue_ratio;
    const ir=(rawRatio!=null&&rawRatio>0&&rawRatio<RATIO_CAP)?rawRatio.toFixed(2):'N/A';
    const rb=c.revenue_yuan?fmtB(c.revenue_yuan):'N/A';
    const cl=ir!='N/A'?(parseFloat(ir)>1?'#ef5350':parseFloat(ir)<0.5?'#66bb6a':'#ffa726'):'#888';
    const ratioNote=rawRatio!=null&&rawRatio>=RATIO_CAP?' ⚠️':'';
    tr.innerHTML='<td>'+c.ticker+'</td><td style="text-align:left;padding-left:10px">'+c.name+'</td>'+
      '<td><span class="sector-tag '+sectorClass(c.sector)+'">'+c.sector+'</span></td>'+
      '<td>'+c.report_date+'</td><td>'+fmtB(c.inventory_yuan)+'</td><td>'+rb+'</td>'+
      '<td style="font-weight:bold;color:'+cl+'">'+ir+'</td>'+
      '<td>'+(c.inventory_to_assets_pct||0).toFixed(1)+'%</td>'+
      '<td>'+(c.inventory_to_current_pct||0).toFixed(1)+'%</td>';
    tb.appendChild(tr)
  })
}

window.addEventListener('DOMContentLoaded',loadAll);
