import { useState, useEffect } from "react";
import { Activity, Gauge, Recycle, Archive, ArrowUpRight, ArrowDownRight, AlertTriangle, TrendingUp, Package, BrainCircuit, RefreshCw } from "lucide-react";
import { apiWasteSummary, apiWasteAlerts, apiStockStatus, apiYarnCounts, apiPlans, apiModelInfo } from "../api/api";

const MiniBar = () => (
  <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:48 }}>
    {[30,55,38,72,50,80,45,90].map((h,i) => (
      <div key={i} style={{ width:8, borderRadius:"3px 3px 0 0", background:"linear-gradient(to top,#d1d5db,#111827)", height:`${h}%`, opacity:0.15+i*0.1 }} />
    ))}
  </div>
);

const StatCard = ({ title, value, trend, isPositive, icon:Icon, iconBg, iconColor, delay, loading }) => (
  <div style={{ background:"#fff", borderRadius:24, padding:24, boxShadow:"0 2px 20px rgba(0,0,0,0.05)", display:"flex", flexDirection:"column", gap:16, transition:"box-shadow .3s,transform .3s", animation:`fadeUp 0.5s ease ${delay}ms both` }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 30px rgba(0,0,0,0.09)";e.currentTarget.style.transform="translateY(-2px)"}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 20px rgba(0,0,0,0.05)";e.currentTarget.style.transform="none"}}>
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:40, height:40, borderRadius:12, background:iconBg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Icon size={18} color={iconColor} />
      </div>
      <span style={{ fontSize:14, fontWeight:600, color:"#374151" }}>{title}</span>
    </div>
    {loading
      ? <div style={{ height:42, background:"#f3f4f6", borderRadius:8, animation:"pulse 1.5s ease infinite" }} />
      : <div style={{ fontSize:"2.6rem", fontWeight:800, color:"#111827", lineHeight:1 }}>{value}</div>}
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3, background:isPositive?"#ecfdf5":"#fff1f2", color:isPositive?"#059669":"#e11d48", border:`1px solid ${isPositive?"#d1fae5":"#ffe4e6"}`, borderRadius:99, padding:"3px 10px", fontSize:12, fontWeight:700 }}>
        {isPositive ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
        {isPositive?"+":""}{trend}
      </span>
      <MiniBar />
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData]         = useState({ waste:null, alerts:[], stock:[], yarns:[], plans:[] });
  const [loading, setLoading]   = useState(true);
  const [updated, setUpdated]   = useState("");
  const [modelStatus, setModelStatus] = useState("checking");

  const load = async () => {
    setLoading(true);
    try {
      const [waste, alerts, stock, yarns, plans, modelInfo] = await Promise.all([
        apiWasteSummary(), apiWasteAlerts(), apiStockStatus(), apiYarnCounts(), apiPlans(),
        apiModelInfo(),
      ]);
      setData({ waste, alerts: alerts.slice(0,5), stock, yarns, plans });
      setModelStatus(modelInfo?.status === "trained" ? "trained" : "not_trained");
      setUpdated(new Date().toLocaleTimeString());
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cotton      = data.stock.find(s => s.material_name === "Cotton Bales");
  const cottonKg    = cotton?.stock_kg ?? 0;
  const totalWaste  = data.waste?.total_waste_kg ?? 0;
  const avgWaste    = data.waste?.avg_waste_pct ?? 0;
  const alertCount  = data.waste?.alert_count ?? 0;
  const activeYarns = data.yarns.length;
  const latestBags  = data.plans[0]?.entries?.reduce((s,e) => s+(e.yarn_bags_per_day||0), 0) ?? 0;

  const aColors = { critical:"#e11d48", warn:"#d97706", info:"#0284c7" };
  const aBgs    = { critical:"#fff1f2", warn:"#fffbeb", info:"#f0f9ff"  };
  const displayAlerts = data.alerts.length > 0
    ? data.alerts.map(a => ({ type: a.excess_pct>1?"critical":"warn", msg:`${a.stage} — ${a.actual_pct}% actual vs ${a.limit_pct}% limit (${a.shift})`, time: new Date(a.date).toLocaleDateString() }))
    : [{ type:"info", msg:"All processes within normal waste limits", time:"Now" }];

  return (
    <div style={{ animation:"fadeUp 0.45s ease both" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <h1 style={{ fontSize:"2.8rem", fontWeight:800, color:"#111827", margin:0 }}>Dashboard</h1>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {updated && <span style={{ fontSize:12, color:"#9ca3af" }}>Updated {updated}</span>}
          <button onClick={load} disabled={loading} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }} /> Refresh
          </button>
        </div>
      </div>

<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:28 }}>        <StatCard title="Yarn Bags / Day"     value={latestBags>0?latestBags.toLocaleString():"No plan"} trend="Live"    isPositive={true}  icon={Activity} iconBg="#f5f3ff" iconColor="#7c3aed" delay={0}   loading={loading} />
        <StatCard title="Active Yarn Counts"  value={activeYarns}                                        trend="Counts"  isPositive={true}  icon={Gauge}    iconBg="#ecfdf5" iconColor="#059669" delay={80}  loading={loading} />
        <StatCard title="Total Waste (kg)"    value={totalWaste.toLocaleString()}                        trend={`${avgWaste}% avg`} isPositive={false} icon={Recycle}  iconBg="#fff1f2" iconColor="#e11d48" delay={160} loading={loading} />
        <StatCard title="Cotton Stock (kg)"   value={cottonKg.toLocaleString()}                          trend="Stock"   isPositive={true}  icon={Archive}  iconBg="#f0f9ff" iconColor="#0284c7" delay={240} loading={loading} />
      </div>

<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:22, boxShadow:"0 2px 18px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#111827" }}>Live Waste Alerts</span>
            {alertCount>0 && <span style={{ background:"#fff1f2", color:"#e11d48", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{alertCount} active</span>}
          </div>
          {loading ? [1,2,3].map(i=><div key={i} style={{ height:38, background:"#f9fafb", borderRadius:8, marginBottom:8, animation:"pulse 1.5s ease infinite" }} />) :
            displayAlerts.map((a,i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:i<displayAlerts.length-1?"1px solid #f3f4f6":"none" }}>
                <div style={{ width:28, height:28, borderRadius:8, background:aBgs[a.type], display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <AlertTriangle size={13} color={aColors[a.type]} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{a.msg}</div>
                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))
          }
        </div>

        <div style={{ background:"#fff", borderRadius:20, padding:22, boxShadow:"0 2px 18px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:16 }}>Module Overview</div>
          {[
            { icon:Activity,     label:"Production Planning", val:loading?"Loading...":`${activeYarns} counts • ${data.plans.length} plans`, color:"#7c3aed", bg:"#f5f3ff" },
            { icon:Package,      label:"Raw Material",        val:loading?"Loading...":cotton?`${cottonKg.toLocaleString()} kg (${cotton.status})`:"No inventory",  color:"#0284c7", bg:"#f0f9ff" },
            { icon:Recycle,      label:"Waste Monitoring",    val:loading?"Loading...":`${alertCount} alerts • ${avgWaste}% avg waste`,   color:"#e11d48", bg:"#fff1f2" },
            { icon:BrainCircuit, label:"AI Prediction",       val:loading?"checking...":modelStatus==="trained"?"✅ ML Model Ready":"⚠️ Model not trained",  color:modelStatus==="trained"?"#059669":"#d97706", bg:modelStatus==="trained"?"#ecfdf5":"#fffbeb" },
          ].map(({ icon:Icon, label, val, color, bg }) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f9fafb" }}>
              <div style={{ width:32, height:32, borderRadius:9, background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon size={15} color={color} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{label}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{val}</div>
              </div>
              <TrendingUp size={13} color="#d1d5db" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
