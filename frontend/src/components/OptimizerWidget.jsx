import React, { useEffect, useState, useRef, useCallback } from "react";
import { Settings } from "lucide-react";

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
function token() { return localStorage.getItem("textile_token"); }

export default function OptimizerWidget({ externalData }) {
  const [form, setForm]     = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const debounceRef = useRef(null);

  // Sync with main production form
  useEffect(() => {
    if (externalData) setForm(externalData);
  }, [externalData]);

  const optimize = useCallback(async (payload) => {
    if (!payload || Object.keys(payload).length === 0) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BASE}/api/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch (err) {
      setError("Could not reach optimizer. Make sure the backend is running.");
      console.error("Optimization error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const runOptimize = useCallback(() => {
    const f = form && Object.keys(form).length > 0 ? form : null;
    if (!f) return;
    optimize({
      temp:       parseFloat(f.temp       || f.temperature_c  || 30),
      humidity:   parseFloat(f.humidity   || f.humidity_pct   || 60),
      speed:      parseFloat(f.speed      || f.spindle_speed  || 19000),
      efficiency: parseFloat(f.efficiency || f.efficiency_pct || 95),
      stage:      f.stage || 5,
      hour:       parseFloat(f.hour       || f.shift_hours    || 8),
    });
  }, [form, optimize]);

  // Auto-run with 1 second debounce when external data changes
  useEffect(() => {
    if (!externalData || Object.keys(externalData).length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      optimize({
        temp:       parseFloat(externalData.temp       || externalData.temperature_c  || 30),
        humidity:   parseFloat(externalData.humidity   || externalData.humidity_pct   || 60),
        speed:      parseFloat(externalData.speed      || externalData.spindle_speed  || 19000),
        efficiency: parseFloat(externalData.efficiency || externalData.efficiency_pct || 95),
        stage:      externalData.stage || 5,
        hour:       parseFloat(externalData.hour       || externalData.shift_hours    || 8),
      });
    }, 1000);
    return () => clearTimeout(debounceRef.current);
  }, [externalData, optimize]);

  const improvementWaste = result ? (result.before_waste - result.after_waste).toFixed(2) : null;
  const improvementProd  = result ? (result.after_production - result.before_production).toFixed(2) : null;

  return (
    <div style={{ background:"#fff", borderRadius:20, boxShadow:"0 2px 18px rgba(0,0,0,0.05)", padding:24, marginTop:24, border:"1.5px solid #f3f4f6" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <div style={{ width:36, height:36, background:"#eff6ff", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Settings size={18} color="#2563eb" />
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:"#111827" }}>Smart RL Optimization</div>
          <div style={{ fontSize:11, color:"#9ca3af" }}>Q-Learning agent • 6 actions</div>
        </div>
      </div>

      {/* Current inputs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, background:"#f9fafb", borderRadius:14, padding:14, marginBottom:16 }}>
        {[
          ["Temp",     `${form.temp     || form.temperature_c  || "—"}°C`],
          ["Humidity", `${form.humidity || form.humidity_pct   || "—"}%`],
          ["Speed",    `${form.speed    || form.spindle_speed  || "—"} RPM`],
        ].map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginTop:3 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#e11d48", marginBottom:14 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={runOptimize}
        disabled={loading}
        style={{ width:"100%", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", border:"none", borderRadius:12, padding:"12px", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1, fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 14px rgba(37,99,235,0.3)" }}>
        {loading ? "Calculating Best Settings..." : "⚡ Find Optimal Settings"}
      </button>

      {/* Result */}
      {result && (
        <div style={{ marginTop:20 }}>

          {/* Action + reward badges */}
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <span style={{ background:"#dbeafe", color:"#1d4ed8", borderRadius:99, padding:"3px 12px", fontSize:11, fontWeight:700 }}>
              Action: {result.action}
            </span>
            <span style={{ background:"#f3f4f6", color:"#6b7280", borderRadius:99, padding:"3px 12px", fontSize:11 }}>
              Reward: {result.reward}
            </span>
          </div>

          {/* Before / After */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div style={{ background:"#f9fafb", borderRadius:12, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Before</div>
              <div style={{ fontSize:13, color:"#374151" }}>Waste: <strong>{result.before_waste}%</strong></div>
              <div style={{ fontSize:13, color:"#374151", marginTop:4 }}>Prod: <strong>{result.before_production} kg</strong></div>
            </div>
            <div style={{ background:"#ecfdf5", borderRadius:12, padding:14, border:"1px solid #d1fae5" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#059669", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>After</div>
              <div style={{ fontSize:13, color:"#374151" }}>
                Waste: <strong style={{ color:"#059669" }}>{result.after_waste}%</strong>
                {parseFloat(improvementWaste) > 0 && <span style={{ fontSize:11, color:"#059669", marginLeft:4 }}>↓{improvementWaste}</span>}
              </div>
              <div style={{ fontSize:13, color:"#374151", marginTop:4 }}>
                Prod: <strong style={{ color:"#059669" }}>{result.after_production} kg</strong>
                {parseFloat(improvementProd) > 0 && <span style={{ fontSize:11, color:"#059669", marginLeft:4 }}>↑{improvementProd}</span>}
              </div>
            </div>
          </div>

          {/* Suggested settings */}
          <div style={{ background:"#eff6ff", borderRadius:12, padding:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#2563eb", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>Suggested Settings</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                ["Temp",       `${result.suggested_temp}°C`],
                ["Humidity",   `${result.suggested_humidity}%`],
                ["Speed",      `${result.suggested_speed} RPM`],
                ["Efficiency", `${result.suggested_efficiency}%`],
              ].map(([label, val]) => (
                <div key={label} style={{ fontSize:13 }}>
                  <span style={{ color:"#9ca3af" }}>{label}: </span>
                  <strong style={{ color:"#111827" }}>{val}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
