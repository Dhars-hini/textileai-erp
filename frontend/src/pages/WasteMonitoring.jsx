import { useState, useEffect } from "react";
import { Trash2, AlertTriangle, TrendingDown, Plus, Activity, RefreshCw } from "lucide-react";
import { apiLogWaste, apiWasteLogs, apiWasteSummary } from "../api/api";

const S = {
  title:  { fontSize:"2.6rem", fontWeight:800, color:"#111827", margin:"0 0 28px 0", lineHeight:1 },
  card:   { background:"#fff", borderRadius:20, boxShadow:"0 2px 18px rgba(0,0,0,0.05)", padding:24, marginBottom:20 },
  label:  { fontSize:12, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5, display:"block" },
  input:  { width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif" },
  select: { width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif", appearance:"none" },
  addBtn: { background:"linear-gradient(135deg,#e11d48,#be123c)", color:"#fff", border:"none", borderRadius:13, padding:"11px 24px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" },
};

const STAGES = ["Blowroom","Carding","Combing","Drawing","Roving","Spinning","Winding"];
const LIMITS  = { Blowroom:1.2, Carding:4.5, Combing:14, Drawing:0.5, Roving:0.8, Spinning:3.25, Winding:0.5 };

export default function WasteMonitoring() {
  const [logs, setLogs]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date:"", shift:"Shift A", stage:"Spinning", actual:"", input:"" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Default to last 30 days so the table shows recent data, not all-time
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      setForm(p => ({ ...p, date: today }));
      const [l, s] = await Promise.all([
        apiWasteLogs(thirtyDaysAgo, today),
        apiWasteSummary(),
      ]);
      setLogs(l); setSummary(s);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveLog = async () => {
    if (!form.actual || !form.input || !form.date) { setSaveMsg("❌ Fill in all fields"); return; }
    setSaving(true); setSaveMsg("");
    try {
      await apiLogWaste({
        log_date:          form.date + "T00:00:00",
        shift:             form.shift,
        process_stage:     form.stage,
        input_material_kg: parseFloat(form.input),
        actual_waste_pct:  parseFloat(form.actual),
      });
      setSaveMsg("✅ Entry saved to database");
      setForm(p => ({ ...p, actual:"", input:"" }));
      setShowForm(false);
      loadAll();
    } catch(e) { setSaveMsg("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const stageData = STAGES.map(stage => {
    const stageLogs = logs.filter(l => l.process_stage === stage);
    const avg = stageLogs.length ? stageLogs.reduce((s,l) => s+l.actual_waste_pct, 0)/stageLogs.length : 0;
    return { stage, avg:avg.toFixed(2), limit:LIMITS[stage], over:avg>LIMITS[stage] };
  });

  const localAlerts = logs.filter(l => l.is_alert);

  return (
    <div style={{ animation:"fadeUp 0.45s ease both" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus,select:focus{border-color:#e11d48!important;}`}</style>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <h1 style={{ ...S.title, margin:0 }}>Waste Monitoring</h1>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={loadAll} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"8px 14px", fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <RefreshCw size={13}/> Refresh
          </button>
          <button style={S.addBtn} onClick={() => setShowForm(!showForm)}><Plus size={14}/> Log Waste Entry</button>
        </div>
      </div>

      {/* Live alerts from DB */}
      {localAlerts.length > 0 && (
        <div style={{ background:"#fff1f2", border:"1.5px solid #fecdd3", borderRadius:16, padding:"14px 18px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <AlertTriangle size={16} color="#e11d48"/>
            <span style={{ fontSize:13, fontWeight:700, color:"#e11d48" }}>{localAlerts.length} Waste Threshold Exceeded (from database)</span>
          </div>
          {localAlerts.slice(0,5).map(a => (
            <div key={a.id} style={{ fontSize:12, color:"#9f1239", marginBottom:3 }}>
              ⚠️ <strong>{a.process_stage}</strong> — {a.actual_waste_pct}% actual vs {a.normal_limit_pct}% limit ({a.shift})
            </div>
          ))}
        </div>
      )}

      {/* Log form */}
      {showForm && (
        <div style={{ ...S.card, border:"1.5px solid #fecdd3", marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:16 }}>New Waste Log Entry → Saves to MySQL</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:14 }}>
            <div><label style={S.label}>Date</label><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
            <div><label style={S.label}>Shift</label>
              <select style={S.select} value={form.shift} onChange={e=>setForm(p=>({...p,shift:e.target.value}))}>
                {["Shift A","Shift B","Shift C"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Process Stage</label>
              <select style={S.select} value={form.stage} onChange={e=>setForm(p=>({...p,stage:e.target.value}))}>
                {STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Input Material (kg)</label><input style={S.input} type="number" value={form.input} onChange={e=>setForm(p=>({...p,input:e.target.value}))}/></div>
            <div><label style={S.label}>Actual Waste (%)</label><input style={S.input} type="number" step="0.01" value={form.actual} onChange={e=>setForm(p=>({...p,actual:e.target.value}))}/></div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button style={{ ...S.addBtn, width:"fit-content" }} onClick={saveLog} disabled={saving}>{saving?"Saving...":"Save to Database"}</button>
            {saveMsg && <span style={{ fontSize:13, fontWeight:600, color:saveMsg.startsWith("✅")?"#059669":"#e11d48" }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* KPI row from backend */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {[
          { label:"Avg Waste %",     val:loading?"...":(summary?.avg_waste_pct??0)+"%",   color:"#e11d48", bg:"#fff1f2", icon:<Activity size={16} color="#e11d48"/> },
          { label:"Total Waste(kg)", val:loading?"...":(summary?.total_waste_kg??0)+" kg", color:"#d97706", bg:"#fffbeb", icon:<Trash2 size={16} color="#d97706"/> },
          { label:"Alerts",          val:loading?"...":(summary?.alert_count??0),          color:"#7c3aed", bg:"#f5f3ff", icon:<AlertTriangle size={16} color="#7c3aed"/> },
          { label:"Entries Logged",  val:loading?"...":logs.length,                        color:"#0284c7", bg:"#f0f9ff", icon:<TrendingDown size={16} color="#0284c7"/> },
        ].map(({label,val,color,bg,icon}) => (
          <div key={label} style={{ background:bg, borderRadius:16, padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>{icon}<span style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span></div>
            <div style={{ fontSize:26, fontWeight:800, color:"#111827" }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Bar chart */}
        <div style={S.card}>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:20 }}>Waste % by Process Stage</div>
          {stageData.map(({stage,avg,limit,over}) => (
            <div key={stage} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{stage}</span>
                <div style={{ display:"flex", gap:8 }}>
                  <span style={{ fontSize:12, color:"#9ca3af" }}>Limit: {limit}%</span>
                  <span style={{ fontSize:12, fontWeight:700, color:over?"#e11d48":"#059669" }}>{avg}%</span>
                </div>
              </div>
              <div style={{ background:"#f3f4f6", borderRadius:99, height:8, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, width:`${Math.min((parseFloat(avg)/(limit*2))*100,100)}%`, background:over?"linear-gradient(90deg,#f43f5e,#e11d48)":"linear-gradient(90deg,#34d399,#059669)", transition:"width .6s ease" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Live logs table from DB */}
        <div style={S.card}>
          <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:16 }}>Recent Entries (from MySQL)</div>
          {loading ? <div style={{ textAlign:"center", color:"#9ca3af", padding:20 }}>Loading...</div> :
            <div style={{ overflowY:"auto", maxHeight:320 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>{["Date","Shift","Stage","Waste %","Status"].map(h=><th key={h} style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", padding:"6px 10px", textAlign:"left", borderBottom:"2px solid #f3f4f6", whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.length === 0
                    ? <tr><td colSpan={5} style={{ textAlign:"center", padding:20, color:"#9ca3af", fontSize:13 }}>No entries yet — log your first waste entry above</td></tr>
                    : logs.map(log => (
                      <tr key={log.id} style={{ borderBottom:"1px solid #f9fafb" }}>
                        <td style={{ padding:"8px 10px", fontSize:12, color:"#374151" }}>{new Date(log.log_date).toLocaleDateString()}</td>
                        <td style={{ padding:"8px 10px", fontSize:12, color:"#374151" }}>{log.shift}</td>
                        <td style={{ padding:"8px 10px", fontSize:12, fontWeight:600, color:"#374151" }}>{log.process_stage}</td>
                        <td style={{ padding:"8px 10px", fontSize:13, fontWeight:700, color:log.is_alert?"#e11d48":"#059669" }}>{log.actual_waste_pct}%</td>
                        <td style={{ padding:"8px 10px" }}>
                          <span style={{ background:log.is_alert?"#fff1f2":"#ecfdf5", color:log.is_alert?"#e11d48":"#059669", borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {log.is_alert?"⚠ Over":"✓ OK"}
                          </span>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  );
}
