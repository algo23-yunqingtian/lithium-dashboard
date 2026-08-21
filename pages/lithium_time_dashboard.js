// lithium_time_dashboard.js
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{if((e.ctrlKey&&['c','s','p'].includes(e.key))||e.key==='F12')e.preventDefault()});
document.body.style.userSelect='none';

const API='/api/lithium';
const tabs=document.querySelectorAll('.tab');
const tabContents=document.querySelectorAll('.tc');
const charts={};
let gData=null;

function switchTab(i){
  tabs.forEach((t,j)=>{t.classList.toggle('active',j===i);tabContents[j].classList.toggle('active',j===i)});
  if(i===0)loadOverview();
  else if(i===1)loadHardRock();
  else if(i===2)loadSaltLake();
  else if(i===3)loadFinancial();
  else if(i===4)loadProjects();
}
tabs.forEach((t,i)=>t.addEventListener('click',()=>switchTab(i)));

function initChart(id){
  const el=document.getElementById(id);if(!el)return null;
  if(charts[id])charts[id].dispose();
  const c=echarts.init(el,'dark');charts[id]=c;return c;
}

async function fetchJ(url){try{const r=await fetch(url);return await r.json()}catch(e){console.error(e);return null}}

async function loadData(){
  if(gData)return gData;
  const r=await fetchJ(`${API}/quarterly_time`);
  if(r&&r.status==='ok')gData=r;
  return gData;
}

// ─── Metrics ───
async function loadMetrics(){
  const d=await loadData();
  if(!d)return;
  const hrCount=new Set(d.production.map(x=>x.ticker)).size;
  const saltCount=new Set(d.salt_quarterly.map(x=>x.project_name)).size;
  const finCount=new Set(d.financials.map(x=>x.ticker)).size;
  const finYears=d.financials.length;
  const saltRows=d.salt_quarterly.length;
  const hrRows=d.production.length;
  document.getElementById('metrics').innerHTML=`
    <div class="met"><div class="v">${hrCount}</div><div class="l">硬岩公司</div></div>
    <div class="met"><div class="v">${saltCount}</div><div class="l">盐湖项目</div></div>
    <div class="met"><div class="v">${finCount}</div><div class="l">财报公司</div></div>
    <div class="met"><div class="v">${finYears}</div><div class="l">财报数据行</div></div>
    <div class="met"><div class="v">${saltRows}</div><div class="l">盐湖时序行</div></div>
    <div class="met"><div class="v">${hrRows}</div><div class="l">硬岩产量行</div></div>`;
}

// ─── Tab 0: 总览 ───
async function loadOverview(){
  const d=await loadData();if(!d)return;
  loadMetrics();

  // 硬岩年度产量堆叠柱状图
  const c1=initChart('c_hr_year');
  if(c1){
    const yrMap={};
    d.production.forEach(r=>{
      const yr=r.quarter?.split('Q')[0]||'?';
      const v=Number(r.production_kt)||0;
      if(!yrMap[yr])yrMap[yr]=[];
      yrMap[yr].push({name:r.company_name||r.ticker,value:v});
    });
    const years=Object.keys(yrMap).sort();
    // 聚合为总量
    const totals=years.map(yr=>yrMap[yr].reduce((s,x)=>s+x.value,0));
    c1.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      grid:{left:50,right:20,top:30,bottom:30},
      xAxis:{type:'category',data:years,axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
      yAxis:{type:'value',name:'kt LCE',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:[{name:'总产量',type:'bar',data:totals,barWidth:30,
        itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#e94560'},{offset:1,color:'#0f3460'}])},
        label:{show:true,position:'top',color:'#fff',formatter:p=>p.value.toFixed(0)}},
       {name:'趋势',type:'line',data:totals,smooth:true,lineStyle:{color:'#00b4d8'},itemStyle:{color:'#00b4d8'}}]
    });
  }

  // 盐湖季度产量趋势
  const c2=initChart('c_salt_year');
  if(c2){
    const qMap={};
    d.salt_quarterly.forEach(r=>{
      const q=r.quarter;
      const v=Number(r.lce_production_kt)||0;
      qMap[q]=(qMap[q]||0)+v;
    });
    const quarters=Object.keys(qMap).sort();
    const vals=quarters.map(q=>qMap[q]);
    c2.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      grid:{left:50,right:20,top:30,bottom:30},
      xAxis:{type:'category',data:quarters,axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
      yAxis:{type:'value',name:'kt LCE/季',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:[{name:'盐湖总产',type:'line',data:vals,smooth:true,lineStyle:{color:'#0891b2',width:2},
        areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(8,145,178,0.3)'},{offset:1,color:'rgba(8,145,178,0)'}])},
        itemStyle:{color:'#0891b2'},
        label:{show:true,position:'top',color:'#fff',formatter:p=>p.value.toFixed(1)}}]
    });
  }

  // 美股营收对比
  const c3=initChart('c_rev');
  if(c3){
    const tickers=[...new Set(d.financials.map(x=>x.ticker))].filter(t=>t);
    const colors=['#e94560','#00b4d8','#f0a500','#28a745','#533483','#ff6b6b','#0891b2'];
    const series=tickers.slice(0,4).map((tk,si)=>({
      name:tk,type:'bar',
      data:d.financials.filter(x=>x.ticker===tk).map(x=>({
        value:x.revenue_m,
        itemStyle:{color:colors[si%colors.length]}
      })),
      barGap:'10%'
    }));
    // Use stacked bar with fiscal_year on x-axis
    const fiscalYrs=[...new Set(d.financials.map(x=>x.fiscal_year))].sort();
    const stackedSeries=tickers.slice(0,4).map((tk,si)=>{
      const entries=d.financials.filter(x=>x.ticker===tk);
      const vals=fiscalYrs.map(fy=>{
        const e=entries.find(x=>x.fiscal_year===fy);
        return e?(e.revenue_m||0):0;
      });
      return{name:tk,type:'bar',stack:'rev',data:vals,itemStyle:{color:colors[si%colors.length]}};
    });
    c3.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'},axisPointer:{type:'shadow'}},
      legend:{data:tickers.slice(0,4),textStyle:{color:'#8899aa'},top:0},
      grid:{left:50,right:20,top:40,bottom:30},
      xAxis:{type:'category',data:fiscalYrs,axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa',rotate:30}},
      yAxis:{type:'value',name:'$M',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:stackedSeries
    });
  }

  // 项目阶段分布
  const c4=initChart('c_stages');
  if(c4){
    const d2=await fetchJ(`${API}/pipeline`);
    if(d2&&d2.data){
      const sc={};d2.data.forEach(p=>{sc[p.development_stage]=(sc[p.development_stage]||0)+1});
      const sorted=Object.entries(sc).sort((a,b)=>b[1]-a[1]);
      c4.setOption({
        tooltip:{trigger:'item',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
        series:[{type:'pie',radius:['40%','70%'],center:['50%','55%'],
          data:sorted.map(([n,v])=>({name:n,value:v})),label:{color:'#ccc',formatter:'{b}: {c}'}}]
      });
    }
  }
}

// ─── Tab 1: 硬岩产量时序 ───
async function loadHardRock(){
  const d=await loadData();if(!d)return;
  const tickers=[...new Set(d.production.map(x=>x.ticker))].filter(t=>t);
  const sel=document.getElementById('sel_hr');
  sel.innerHTML=`<option value="__all__">全部</option>`+tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
  sel.onchange=()=>renderHardRock(sel.value);
  renderHardRock(tickers[0]||'__all__');
}

function renderHardRock(ticker){
  const d=gData;if(!d)return;
  const c=initChart('c_hr_quarter');if(!c)return;
  let filtered=d.production.filter(x=>x.production_kt);
  if(ticker!=='__all__')filtered=filtered.filter(x=>x.ticker===ticker);
  const sorted=filtered.sort((a,b)=>(a.quarter||'').localeCompare(b.quarter||''));
  const groups={};
  sorted.forEach(r=>{
    const key=r.ticker;
    if(!groups[key])groups[key]=[];
    groups[key].push(r);
  });
  const colors=['#e94560','#00b4d8','#f0a500','#28a745','#533483'];
  const series=Object.keys(groups).map((tk,si)=>({
    name:tk,type:'line',
    data:groups[tk].map(r=>({value:Number(r.production_kt),itemStyle:{color:colors[si%colors.length]}})),
    smooth:true,lineStyle:{width:2,color:colors[si%colors.length]},symbol:'circle',symbolSize:8
  }));
  c.setOption({
    tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
    legend:{data:Object.keys(groups),textStyle:{color:'#8899aa'},top:0},
    grid:{left:50,right:20,top:40,bottom:40},
    xAxis:{type:'category',data:sorted.map(r=>r.quarter),axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
    yAxis:{type:'value',name:'kt',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
    series:series
  });
}

// ─── Tab 2: 盐湖产量时序 ───
async function loadSaltLake(){
  const d=await loadData();if(!d)return;
  const projects=[...new Set(d.salt_quarterly.map(x=>x.project_name))].filter(p=>p);
  const sel=document.getElementById('sel_salt');
  sel.innerHTML=`<option value="__all__">全部</option>`+projects.map(p=>`<option value="${p}">${p}</option>`).join('');
  sel.onchange=()=>renderSaltLake(sel.value);
  renderSaltLake(projects[0]||'__all__');
}

function renderSaltLake(project){
  const d=gData;if(!d)return;
  let filtered=d.salt_quarterly;
  if(project!=='__all__')filtered=filtered.filter(x=>x.project_name===project);
  const sorted=filtered.sort((a,b)=>(a.quarter||'').localeCompare(b.quarter||''));
  const groups={};
  sorted.forEach(r=>{const k=r.project_name;if(!groups[k])groups[k]=[];groups[k].push(r)});
  const colors=['#0891b2','#e94560','#f0a500','#28a745','#533483'];

  // 产量图
  const c1=initChart('c_salt_quarter');if(c1){
    const series=Object.keys(groups).map((pk,si)=>({
      name:pk,type:'bar',
      data:groups[pk].map(r=>Number(r.lce_production_kt)||0),
      barWidth:16,itemStyle:{color:colors[si%colors.length]},
      label:{show:groups[pk].length<=8,position:'top',color:'#fff',formatter:p=>p.value>0?`${p.value.toFixed(1)}`:''}
    }));
    c1.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      legend:{data:Object.keys(groups),textStyle:{color:'#8899aa'},top:0},
      grid:{left:50,right:20,top:40,bottom:40},
      xAxis:{type:'category',data:sorted.map(r=>r.quarter),axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
      yAxis:{type:'value',name:'kt LCE/季',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:series
    });
  }

  // C1成本图
  const c2=initChart('c_salt_c1');if(c2){
    const c1s=Object.keys(groups).map((pk,si)=>({
      name:pk,type:'line',
      data:groups[pk].map(r=>r.c1_cost_usd_t?Number(r.c1_cost_usd_t):null),
      smooth:true,lineStyle:{color:colors[si%colors.length],width:2},symbol:'circle',symbolSize:6
    }));
    c2.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      legend:{data:Object.keys(groups),textStyle:{color:'#8899aa'},top:0},
      grid:{left:50,right:20,top:40,bottom:30},
      xAxis:{type:'category',data:sorted.map(r=>r.quarter),axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
      yAxis:{type:'value',name:'$/t',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:c1s
    });
  }

  // AISC成本图
  const c3=initChart('c_salt_aisc');if(c3){
    const ais=Object.keys(groups).map((pk,si)=>({
      name:pk,type:'line',
      data:groups[pk].map(r=>r.aisc_usd_t?Number(r.aisc_usd_t):null),
      smooth:true,lineStyle:{color:colors[si%colors.length],width:2},symbol:'circle',symbolSize:6
    }));
    c3.setOption({
      tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      legend:{data:Object.keys(groups),textStyle:{color:'#8899aa'},top:0},
      grid:{left:50,right:20,top:40,bottom:30},
      xAxis:{type:'category',data:sorted.map(r=>r.quarter),axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa'}},
      yAxis:{type:'value',name:'$/t',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'}},
      series:ais
    });
  }
}

// ─── Tab 3: 美股财报时序 ───
async function loadFinancial(){
  const d=await loadData();if(!d)return;
  const tickers=[...new Set(d.financials.map(x=>x.ticker))].filter(t=>t);
  const sel=document.getElementById('sel_fin');
  sel.innerHTML=tickers.map(t=>`<option value="${t}">${t}</option>`).join('');
  sel.onchange=()=>renderFinancial(sel.value);
  renderFinancial(tickers[0]||'ALB');
}

function renderFinancial(ticker){
  const d=gData;if(!d)return;
  const c=initChart('c_financial');if(!c)return;
  const entries=d.financials.filter(x=>x.ticker===ticker).sort((a,b)=>(a.quarter||'').localeCompare(b.quarter||''));
  const labels=entries.map(x=>x.fiscal_year||x.quarter||'');
  const rev=entries.map(x=>x.revenue_m||0);
  const profit=entries.map(x=>x.net_profit_m||0);
  const colors=['#e94560','#00b4d8','#f0a500','#28a745','#533483'];
  c.setOption({
    tooltip:{trigger:'axis',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'},axisPointer:{type:'shadow'}},
    legend:{data:['营收','$M','净利润','$M'],textStyle:{color:'#8899aa'},top:0},
    grid:{left:60,right:60,top:50,bottom:40},
    xAxis:{type:'category',data:labels,axisLine:{lineStyle:{color:'#333'}},axisLabel:{color:'#8899aa',rotate:45}},
    yAxis:[
      {type:'value',name:'营收 ($M)',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'#222'}},axisLabel:{color:'#8899aa'},position:'left'},
      {type:'value',name:'净利润 ($M)',nameTextStyle:{color:'#8899aa'},axisLine:{lineStyle:{color:'#333'}},splitLine:{lineStyle:{color:'transparent'}},axisLabel:{color:'#8899aa'},position:'right'}
    ],
    series:[
      {name:'营收 ($M)',type:'bar',data:rev,barWidth:24,
        itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#e94560'},{offset:1,color:'#0f3460'}])},
        label:{show:rev.length<=15,position:'top',color:'#fff',formatter:p=>p.value>0?`${p.value.toFixed(0)}`:''}},
      {name:'净利润 ($M)',type:'bar',data:profit,yAxisIndex:1,barWidth:24,
        itemStyle:{color:p=>profit[p.dataIndex]>=0?'#28a745':'#e94560'},
        label:{show:rev.length<=15,position:'inside',color:'#fff',formatter:p=>p.value?`${p.value.toFixed(0)}`:''}}
    ]
  });
}

// ─── Tab 4: 项目分布 ───
async function loadProjects(){
  const d=await loadData();if(!d)return;
  const pipe=await fetchJ(`${API}/pipeline`);
  const africa=await fetchJ(`${API}/africa`);
  
  // 国家分布
  const c1=initChart('c_countries');if(c1){
    const cc={};
    (pipe?.data||[]).forEach(p=>{cc[p.country]=(cc[p.country]||0)+1});
    (africa?.data||[]).forEach(p=>{cc[p.country]=(cc[p.country]||0)+1});
    const sorted=Object.entries(cc).sort((a,b)=>b[1]-a[1]);
    c1.setOption({
      tooltip:{trigger:'item',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      series:[{type:'pie',radius:['40%','70%'],center:['50%','55%'],
        data:sorted.map(([n,v])=>({name:n,value:v})),label:{color:'#ccc',formatter:'{b}: {c} ({d}%)'}}]
    });
  }

  // 阶段分布
  const c2=initChart('c_stage_dist');if(c2){
    const sc={};
    (pipe?.data||[]).forEach(p=>{sc[p.development_stage]=(sc[p.development_stage]||0)+1});
    (africa?.data||[]).forEach(p=>{sc[p.development_stage]=(sc[p.development_stage]||0)+1});
    const order=['exploration','planning','feasibility','construction','pre-production','operating'];
    const fd=order.map(s=>({name:s,value:sc[s]||0})).filter(x=>x.value>0);
    const stageColors=['#533483','#0f3460','#00b4d8','#e94560','#f0a500','#28a745'];
    c2.setOption({
      tooltip:{trigger:'item',backgroundColor:'#16213e',borderColor:'#333',textStyle:{color:'#fff'}},
      series:[{type:'funnel',left:'10%',right:'10%',top:20,bottom:20,width:'80%',
        data:fd,label:{color:'#fff'},itemStyle:{borderColor:'#1a1a2e',borderWidth:2,
          color:p=>stageColors[p.dataIndex%stageColors.length]}}]
    });
  }
}

// ─── Tab 5: 数据明细 ───
function showDataTable(type){
  const d=gData;if(!d)return;
  let t='';
  if(type==='production'){
    t='<table><tr><th>公司</th><th>代码</th><th>季度</th><th>财年</th><th>产量(kt)</th><th>销量(kt)</th><th>LCE产量</th><th>类型</th><th>地区</th></tr>';
    d.production.forEach(r=>{
      t+=`<tr><td>${r.company_name||'-'}</td><td>${r.ticker}</td><td>${r.quarter}</td><td>${r.fiscal_year}</td><td>${r.production_kt??'-'}</td><td>${r.sales_kt??'-'}</td><td>${r.production_lce_kt??'-'}</td><td>${r.resource_type||'-'}</td><td>${r.region||'-'}</td></tr>`;
    });
  }else if(type==='salt'){
    t='<table><tr><th>公司</th><th>项目</th><th>国家</th><th>季度</th><th>LCE产量(kt)</th><th>年化(kt)</th><th>C1($/t)</th><th>AISC($/t)</th><th>指引</th></tr>';
    d.salt_quarterly.forEach(r=>{
      t+=`<tr><td>${r.company_name}</td><td>${r.project_name}</td><td>${r.country}</td><td>${r.quarter}</td><td>${r.lce_production_kt??'-'}</td><td>${r.lce_annualized_kt??'-'}</td><td>${r.c1_cost_usd_t??'-'}</td><td>${r.aisc_usd_t??'-'}</td><td>${r.production_guidance||'-'}</td></tr>`;
    });
  }else if(type==='financial'){
    t='<table><tr><th>代码</th><th>公司</th><th>季度</th><th>财年</th><th>营收($M)</th><th>净利润($M)</th><th>地区</th><th>交易所</th></tr>';
    d.financials.forEach(r=>{
      const profit=r.net_profit_m;
      const color=profit&&profit<0?'#e94560':'#28a745';
      t+=`<tr><td>${r.ticker}</td><td>${r.company_name||'-'}</td><td>${r.quarter}</td><td>${r.fiscal_year}</td><td>${r.revenue_m!=null?r.revenue_m.toFixed(1):'-'}</td><td style="color:${color}">${profit!=null?profit.toFixed(1):'-'}</td><td>${r.region||'-'}</td><td>${r.exchange||'-'}</td></tr>`;
    });
  }
  t+='</table>';
  document.getElementById('t_data_detail').innerHTML=t;
}

// ─── Init ───
async function refreshAll(){loadData().then(()=>loadOverview())}

window.addEventListener('DOMContentLoaded',()=>{loadData().then(()=>loadOverview())});
window.addEventListener('resize',()=>{Object.values(charts).forEach(c=>c.resize())});
