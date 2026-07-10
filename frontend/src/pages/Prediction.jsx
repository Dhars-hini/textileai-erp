import React, { useState, useEffect } from "react";
import OptimizerWidget from "../components/OptimizerWidget";
import {
  apiPredictProd, apiPredictWaste, apiModelInfo,
  apiGenerateHistory, apiAutoLog, apiTrainModel,
  apiForecast7Day, apiForecastStages
} from "../api/api";

import {
  BrainCircuit, RefreshCw, Target, 
  Database, Zap, TrendingUp,
  BarChart2, Settings
} from "lucide-react";

const S = {
  card:  { background:"#fff", borderRadius:20, boxShadow:"0 2px 18px rgba(0,0,0,0.05)", padding:24, marginBottom:20 },
  label: { fontSize:12, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5, display:"block" },
  input: { width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif" },
  btn:   (bg, shadow) => ({ background:bg, color:"#fff", border:"none", borderRadius:12, padding:"11px 22px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans',sans-serif", boxShadow:shadow||"none" }),
};

// ── Subcomponents ──────────────────────────────────────────────────

function ModelStatusCard({ info, onRefresh }) {
  const trained = info?.status === "trained";
  return (
    <div style={{ ...S.card, background: trained ? "linear-gradient(135deg,#ecfdf5,#d1fae5)" : "linear-gradient(135deg,#fffbeb,#fde68a)", border: `1.5px solid ${trained?"#6ee7b7":"#fbbf24"}` }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, background:trained?"#059669":"#d97706", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BrainCircuit size={22} color="#fff"/>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#111827" }}>
              {trained ? "✅ ML Model Trained & Ready" : "⚠️ Model Not Trained Yet"}
            </div>
            {trained ? (
              <div style={{ fontSize:12, color:"#059669", marginTop:3 }}>
                Trained on <strong>{info.total_logs_used}</strong> logs • 
                Waste R²: <strong>{info.waste_results?.RandomForest?.r2}</strong> • 
                Production R²: <strong>{info.prod_results?.RandomForest?.r2}</strong> •
                {new Date(info.trained_at).toLocaleDateString()}
              </div>
            ) : (
              <div style={{ fontSize:12, color:"#92400e", marginTop:3 }}>
                Generate history data → then train model to enable ML predictions
              </div>
            )}
          </div>
        </div>
        <button onClick={onRefresh} style={{ background:"rgba(0,0,0,0.06)", border:"none", borderRadius:9, padding:"7px 12px", cursor:"pointer", fontSize:12, fontWeight:600, color:"#374151" }}>
          <RefreshCw size={13}/> Refresh
        </button>
      </div>
      {trained && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:16 }}>
          {[
            { label:"Waste Samples",  val: info.waste_samples,  color:"#e11d48" },
            { label:"Prod Samples",   val: info.prod_samples,   color:"#7c3aed" },
            { label:"Best Waste R²",  val: info.waste_results?.RandomForest?.r2, color:"#059669" },
            { label:"Best Prod R²",   val: info.prod_results?.RandomForest?.r2,  color:"#0284c7" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.7)", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:"#111827", marginTop:4 }}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSetupPanel({ onDone }) {
  const [days, setDays] = useState(30);
  const [shift, setShift] = useState("");
  const [genMsg, setGenMsg] = useState("");
  const [shiftMsg, setShiftMsg] = useState("");
  const [trainMsg, setTrainMsg] = useState("");
  const [loading, setLoading] = useState({});

  const set = (k, v) => setLoading(p => ({ ...p, [k]: v }));

  const generateHistory = async () => {
    set("hist", true); setGenMsg("");
    try {
      const r = await apiGenerateHistory(days);
      setGenMsg(`✅ Generated ${r.entries_created} entries for ${r.days} days`);
      onDone();
    } catch(e) { setGenMsg("❌ " + e.message); }
    finally { set("hist", false); }
  };

  const generateShift = async () => {
    set("shift", true); setShiftMsg("");
    try {
      const r = await apiAutoLog(shift || null);
      setShiftMsg(`✅ ${r.entries_created} entries added for ${r.shift}`);
      onDone();
    } catch(e) { setShiftMsg("❌ " + e.message); }
    finally { set("shift", false); }
  };

  const trainModel = async () => {
    set("train", true); setTrainMsg("🔄 Training started — takes ~15 seconds...");
    try {
      await apiTrainModel();
      setTimeout(() => { setTrainMsg("✅ Training complete! Refresh model status."); onDone(); }, 18000);
    } catch(e) { setTrainMsg("❌ " + e.message); set("train", false); }
  };

  return (
    <div style={S.card}>
      <div style={{ fontSize:15, fontWeight:800, color:"#111827", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
        <Settings size={18} color="#7c3aed"/> AI Setup — Generate Data & Train Model
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
        <div style={{ background:"#f5f3ff", borderRadius:14, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Step 1 — Generate History</div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Creates realistic waste logs for past N days.</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
            <input type="number" min="7" max="365" value={days} onChange={e=>setDays(+e.target.value)} style={{ ...S.input, width:90 }} />
            <span style={{ fontSize:12, color:"#6b7280" }}>days</span>
          </div>
          <button style={S.btn("linear-gradient(135deg,#7c3aed,#6d28d9)","0 4px 14px rgba(124,58,237,0.3)")} onClick={generateHistory} disabled={loading.hist}>
            <Database size={14}/> {loading.hist ? "Generating..." : "Generate History"}
          </button>
          {genMsg && <div style={{ fontSize:12, marginTop:10, color:genMsg.startsWith("✅")?"#059669":"#e11d48", fontWeight:600 }}>{genMsg}</div>}
        </div>

        <div style={{ background:"#f0f9ff", borderRadius:14, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#0284c7", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Step 2 — Auto Log Shift</div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Generates one shift's worth of waste logs right now.</div>
          <div style={{ marginBottom:12 }}>
            <select style={S.input} value={shift} onChange={e=>setShift(e.target.value)}>
              <option value="">Auto-detect shift</option>
              <option>Shift A</option><option>Shift B</option><option>Shift C</option>
            </select>
          </div>
          <button style={S.btn("linear-gradient(135deg,#0284c7,#0369a1)","0 4px 14px rgba(2,132,199,0.3)")} onClick={generateShift} disabled={loading.shift}>
            <Zap size={14}/> {loading.shift ? "Generating..." : "Auto Log Shift"}
          </button>
          {shiftMsg && <div style={{ fontSize:12, marginTop:10, color:shiftMsg.startsWith("✅")?"#059669":"#e11d48", fontWeight:600 }}>{shiftMsg}</div>}
        </div>

        <div style={{ background:"#ecfdf5", borderRadius:14, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#059669", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Step 3 — Train ML Model</div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Trains Linear Regression + Random Forest. Needs 50+ logs.</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
            {["scikit-learn","RandomForest"].map(t=>(
              <span key={t} style={{ background:"#d1fae5", color:"#065f46", borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{t}</span>
            ))}
          </div>
          <button style={S.btn("linear-gradient(135deg,#059669,#047857)","0 4px 14px rgba(5,150,105,0.3)")} onClick={trainModel} disabled={loading.train}>
            <BrainCircuit size={14}/> {loading.train ? "Training..." : "Train Model"}
          </button>
          {trainMsg && <div style={{ fontSize:12, marginTop:10, color:trainMsg.startsWith("✅")?"#059669":trainMsg.startsWith("🔄")?"#0284c7":"#e11d48", fontWeight:600 }}>{trainMsg}</div>}
        </div>
      </div>
    </div>
  );
}

function PredictionPanel({ modelInfo, prodForm, setProdForm }) {
  const [wasteForm, setWasteForm] = useState({ spindle_speed:20000, efficiency_pct:98, humidity_pct:60, temperature_c:30, stage:"Spinning" });
  const [prodRes, setProdRes]   = useState(null);
  const [wasteRes, setWasteRes] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const run = async () => {
    setLoading(true); setError(""); setProdRes(null); setWasteRes(null);
    try {
      const [p, w] = await Promise.all([
        apiPredictProd(prodForm),
        apiPredictWaste(wasteForm),
      ]);
      setProdRes(p); setWasteRes(w);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const tc = { increase:"#e11d48", decrease:"#059669", stable:"#0284c7" };
  const tbg = { increase:"#fff1f2", decrease:"#ecfdf5", stable:"#f0f9ff" };

  return (
    <div style={S.card}>
      <div style={{ fontSize:15, fontWeight:800, color:"#111827", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
        <Target size={18} color="#7c3aed"/> Run Prediction
        {modelInfo?.status === "trained" && <span style={{ background:"#ecfdf5", color:"#059669", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>ML Model Active</span>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={{ background:"#fafafa", borderRadius:14, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:14 }}>Production Inputs</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              ["Spindle Speed (RPM)","spindle_speed"],["Efficiency (%)","efficiency_pct"],
              ["Waste (%)","waste_pct"],           ["Shift Hours","shift_hours"],
              ["Nominal Count","nominal_count"],    ["Temperature (°C)","temperature_c"],
              ["Humidity (%)","humidity_pct"],
            ].map(([label, key]) => (
              <div key={key}>
                <label style={S.label}>{label}</label>
                <input style={S.input} type="number" step="0.01" value={prodForm[key]}
                  onChange={e=>setProdForm(p=>({...p,[key]:e.target.value}))} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"#fafafa", borderRadius:14, padding:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#e11d48", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:14 }}>Waste Prediction Inputs</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              ["Spindle Speed","spindle_speed"],["Efficiency (%)","efficiency_pct"],
              ["Humidity (%)","humidity_pct"],  ["Temperature (°C)","temperature_c"],
            ].map(([label, key]) => (
              <div key={key}>
                <label style={S.label}>{label}</label>
                <input style={S.input} type="number" step="0.1" value={wasteForm[key]}
                  onChange={e=>setWasteForm(p=>({...p,[key]:+e.target.value}))} />
              </div>
            ))}
            <div>
              <label style={S.label}>Process Stage</label>
              <select style={S.input} value={wasteForm.stage} onChange={e=>setWasteForm(p=>({...p,stage:e.target.value}))}>
                {["Blowroom","Carding","Combing","Drawing","Roving","Spinning","Winding"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#e11d48", marginBottom:16 }}>❌ {error}</div>}

      <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
        <button style={{ ...S.btn("linear-gradient(135deg,#0f172a,#1e293b)","0 4px 20px rgba(15,23,42,0.3)"), padding:"13px 36px", fontSize:15 }} onClick={run} disabled={loading}>
          {loading ? <RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }}/> : <BrainCircuit size={16}/>}
          {loading ? "Running Model..." : "Run AI Prediction"}
        </button>
      </div>

      {prodRes && wasteRes && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", borderRadius:16, padding:20, border:"1.5px solid #ddd6fe" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>🎯 Predicted Production</div>
            <div style={{ fontSize:"3rem", fontWeight:800, color:"#111827", lineHeight:1, marginBottom:6 }}>
              {parseFloat(prodRes.predicted_value).toLocaleString()} <span style={{ fontSize:18, color:"#6b7280" }}>kg/day</span>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:12 }}>Range: {parseFloat(prodRes.lower_bound).toLocaleString()} – {parseFloat(prodRes.upper_bound).toLocaleString()} kg</div>
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"8px 14px", flex:1, textAlign:"center" }}>
                <div style={{ fontSize:10, color:"#059669", fontWeight:700 }}>CONFIDENCE</div>
                <div style={{ fontSize:20, fontWeight:800, color:"#059669" }}>{prodRes.confidence_pct}%</div>
              </div>
            </div>
          </div>

          <div style={{ background:tbg[wasteRes.trend]||"#f9fafb", borderRadius:16, padding:20, border:`1.5px solid ${tc[wasteRes.trend]}30` }}>
            <div style={{ fontSize:11, fontWeight:700, color:tc[wasteRes.trend], textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>📉 Waste Prediction</div>
            <div style={{ fontSize:"3rem", fontWeight:800, color:"#111827", lineHeight:1, marginBottom:6 }}>
              {wasteRes.predicted_value}<span style={{ fontSize:18, color:"#6b7280" }}>%</span>
            </div>
            <div style={{ background:`${tc[wasteRes.trend]}15`, border:`1px solid ${tc[wasteRes.trend]}30`, borderRadius:10, padding:"10px 14px", fontSize:13, fontWeight:600, color:tc[wasteRes.trend] }}>
              {wasteRes.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForecastPanel() {
  const [params, setParams] = useState({ spindle_speed:20000, efficiency_pct:98, waste_pct:3.25, temperature_c:30, humidity_pct:60 });
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const [f] = await Promise.all([
        apiForecast7Day(params.spindle_speed, params.efficiency_pct, params.waste_pct),
        apiForecastStages(params.temperature_c, params.humidity_pct, params.spindle_speed, params.efficiency_pct),
      ]);
      setForecast(f);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const maxKg = forecast ? Math.max(...forecast.forecast.map(d => d.upper)) : 1;

  return (
    <div style={S.card}>
      <div style={{ fontSize:15, fontWeight:800, color:"#111827", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
        <BarChart2 size={18} color="#0284c7"/> 7-Day Forecast + Stage Waste Prediction
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {[
          ["Spindle Speed","spindle_speed"],["Efficiency (%)","efficiency_pct"],
          ["Waste (%)","waste_pct"],        ["Temp (°C)","temperature_c"],
          ["Humidity (%)","humidity_pct"],
        ].map(([label, key]) => (
          <div key={key}>
            <label style={S.label}>{label}</label>
            <input style={S.input} type="number" step="0.1" value={params[key]}
              onChange={e=>setParams(p=>({...p,[key]:+e.target.value}))} />
          </div>
        ))}
      </div>
      <button style={S.btn("linear-gradient(135deg,#0284c7,#0369a1)","0 4px 14px rgba(2,132,199,0.3)")} onClick={run} disabled={loading}>
        <TrendingUp size={14}/> {loading ? "Forecasting..." : "Generate Forecast"}
      </button>

      {forecast && (
          <div style={{ marginTop:20, height:200, display:"flex", alignItems:"flex-end", gap:10 }}>
              {forecast.forecast.map(d => (
                  <div key={d.day} style={{ flex:1, background:"#0284c7", height:`${(d.predicted_kg/maxKg)*100}%`, borderRadius:"4px 4px 0 0" }} />
              ))}
          </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function AIPrediction() {
  const [modelInfo, setModelInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("predict");
  
  // ✅ 1. Lift the form state up so both the Panel and the Widget can see it
 const [prodForm, setProdForm] = useState({
    temperature_c: 30,
    humidity_pct: 60,
    spindle_speed: 20000,
    efficiency_pct: 98,
    shift_hours: 12
  });
  

  const [optimizerData, setOptimizerData] = useState(null);

  const loadModelInfo = async () => {
    try { setModelInfo(await apiModelInfo()); } catch {}
  };

  useEffect(() => { loadModelInfo(); }, []);

  // ✅ 2. Sync data whenever prodForm changes
  useEffect(() => {
    setOptimizerData({
      temp: Number(prodForm.temperature_c),
      humidity: Number(prodForm.humidity_pct),
      speed: Number(prodForm.spindle_speed),
      efficiency: Number(prodForm.efficiency_pct),
      stage: 5,
      hour: Number(prodForm.shift_hours) || 12
    });
  }, [prodForm]);

  const TABS = [
    { id:"setup",   label:"Setup & Train",    icon:Settings },
    { id:"predict", label:"Run Prediction",   icon:BrainCircuit },
    { id:"forecast",label:"7-Day Forecast",   icon:BarChart2 },
  ];

  return (
    <div style={{ animation:"fadeUp 0.45s ease both", padding: "20px" }}>
      <h1 style={{ fontSize:"2.6rem", fontWeight:800, color:"#111827", margin:"0 0 20px 0" }}>AI Prediction</h1>

      <ModelStatusCard info={modelInfo} onRefresh={loadModelInfo} />
      
      {/* ✅ 3. Pass the synced data to the widget */}
      <OptimizerWidget externalData={optimizerData} />

      <div style={{ display:"flex", gap:8, marginBottom:20, marginTop:20 }}>
        {TABS.map(({ id, label, icon:Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ 
              display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:12, border:"none", cursor:"pointer",
              background: activeTab===id ? "#111827" : "#fff",
              color: activeTab===id ? "#fff" : "#6b7280",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {activeTab === "setup"   && <DataSetupPanel onDone={loadModelInfo} />}
      {/* ✅ 4. Pass the shared state to the panel */}
      {activeTab === "predict" && <PredictionPanel modelInfo={modelInfo} prodForm={prodForm} setProdForm={setProdForm} />}
      {activeTab === "forecast"&& <ForecastPanel />}
    </div>
  );
}