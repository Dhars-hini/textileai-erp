import { useState, useEffect } from "react";
import { Calculator, ChevronDown, ChevronUp, Plus, Trash2, CheckCircle, Save } from "lucide-react";
import { apiQuickCalc, apiSavePlan, apiYarnCounts } from "../api/api";

const S = {
  page:  { animation:"fadeUp 0.45s ease both" },
  title: { fontSize:"2.6rem", fontWeight:800, color:"#111827", margin:"0 0 28px 0", lineHeight:1 },
  card:  { background:"#fff", borderRadius:20, boxShadow:"0 2px 18px rgba(0,0,0,0.05)", padding:24, marginBottom:20 },
  label: { fontSize:12, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5, display:"block" },
  input: { width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif", transition:"border-color .2s" },
  select:{ width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif", appearance:"none", cursor:"pointer" },
  calcBtn:{ background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", border:"none", borderRadius:13, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(124,58,237,0.35)", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" },
  saveBtn:{ background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", border:"none", borderRadius:13, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(5,150,105,0.3)", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" },
  addBtn: { background:"#f5f3ff", color:"#7c3aed", border:"none", borderRadius:11, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"'DM Sans',sans-serif" },
  resultRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #f3f4f6" },
  resultKey:{ fontSize:13, color:"#6b7280", fontWeight:500 },
  resultVal:{ fontSize:14, fontWeight:700, color:"#111827" },
};

const PRESETS = {
  "40s Cbd Hsy":  { nominal_count:38.5, spindle_speed:20000, tpi:3.6, efficiency_pct:98, spindles_per_machine:1008, waste_pct:3.25 },
  "40s Cbd Warp": { nominal_count:41.0, spindle_speed:21000, tpi:3.6, efficiency_pct:98, spindles_per_machine:1008, waste_pct:3.25 },
  "30s Cbd Hsy":  { nominal_count:29.0, spindle_speed:18000, tpi:3.6, efficiency_pct:98, spindles_per_machine:1008, waste_pct:3.25 },
  "24s Cbd Hsy":  { nominal_count:23.0, spindle_speed:17000, tpi:3.6, efficiency_pct:98, spindles_per_machine:1008, waste_pct:3.25 },
  "Custom":       { nominal_count:"", spindle_speed:"", tpi:"", efficiency_pct:98, spindles_per_machine:1008, waste_pct:3.25 },
};

const newRow = () => ({ id:Date.now(), countLabel:"40s Cbd Hsy", production_target_kg:4900, ...PRESETS["40s Cbd Hsy"], result:null, open:true });

export default function ProductionPlanning() {
  const [rows, setRows]     = useState([newRow()]);
  const [calculated, setCalc] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [planName, setPlanName] = useState("");
  const [yarnCountMap, setYarnCountMap] = useState({}); // label → id

  // Load yarn count IDs from DB on mount
  useEffect(() => {
    apiYarnCounts().then(counts => {
      const map = {};
      counts.forEach(c => { map[c.count_label] = c.id; });
      setYarnCountMap(map);
    }).catch(() => {});
  }, []);

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: value };
      if (field === "countLabel" && PRESETS[value]) return { ...u, ...PRESETS[value] };
      return u;
    }));
    setCalc(false);
  };

  const addRow    = () => setRows(p => [...p, newRow()]);
  const removeRow = id => setRows(p => p.filter(r => r.id !== id));
  const toggleOpen= id => setRows(p => p.map(r => r.id===id ? {...r, open:!r.open} : r));

  // Call backend for each row calculation
  const calculate = async () => {
    const updated = await Promise.all(rows.map(async r => {
      try {
        const res = await apiQuickCalc({
          production_target_kg: parseFloat(r.production_target_kg),
          nominal_count:        parseFloat(r.nominal_count),
          spindle_speed:        parseFloat(r.spindle_speed),
          tpi:                  parseFloat(r.tpi),
          efficiency_pct:       parseFloat(r.efficiency_pct),
          spindles_per_machine: parseInt(r.spindles_per_machine),
          waste_pct:            parseFloat(r.waste_pct),
        });
        return { ...r, result: res };
      } catch(e) { return { ...r, result: null, error: e.message }; }
    }));
    setRows(updated);
    setCalc(true);
  };

  // Save plan to backend DB
  const savePlan = async () => {
    // Validate that every row has a known yarn count ID before saving
    const unknownLabels = rows
      .filter(r => !yarnCountMap[r.countLabel])
      .map(r => r.countLabel);

    if (unknownLabels.length > 0) {
      setSaveMsg(`❌ Cannot save — yarn count(s) not found in database: ${unknownLabels.join(", ")}. Add them via the backend first, or choose a preset.`);
      return;
    }

    setSaving(true); setSaveMsg("");
    try {
      await apiSavePlan({
        plan_date: new Date().toISOString(),
        plan_name: planName || `Plan ${new Date().toLocaleDateString()}`,
        entries: rows.map(r => ({
          yarn_count_id:        yarnCountMap[r.countLabel],
          production_target_kg: parseFloat(r.production_target_kg),
          spindle_speed:        parseFloat(r.spindle_speed),
          efficiency_pct:       parseFloat(r.efficiency_pct),
          waste_pct:            parseFloat(r.waste_pct),
        })),
      });
      setSaveMsg("✅ Plan saved to database!");
    } catch(e) { setSaveMsg("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const totals = calculated ? rows.reduce((acc,r) => {
    if (!r.result) return acc;
    acc.frames   += parseFloat(r.result.frames_required   || 0);
    acc.spindles += parseFloat(r.result.spindles_required || 0);
    acc.bales    += parseFloat(r.result.bales_per_day     || 0);
    acc.bags     += parseInt(r.result.yarn_bags_per_day   || 0);
    return acc;
  }, { frames:0, spindles:0, bales:0, bags:0 }) : null;

  return (
    <div style={S.page}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus,select:focus{border-color:#a78bfa!important;} .remove-btn{background:#fff1f2;color:#e11d48;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;}`}</style>
      <h1 style={S.title}>Production Planning</h1>

      <div style={{ ...S.card, background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", border:"1px solid #ddd6fe", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, background:"#7c3aed", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}><Calculator size={18} color="#fff" /></div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#4c1d95" }}>Spinning Production Calculator — Connected to Backend</div>
            <div style={{ fontSize:12, color:"#7c3aed", marginTop:2 }}>Calculations run on server using Excel formulas. Results are saved to MySQL database.</div>
          </div>
        </div>
      </div>

      {rows.map((row, idx) => (
        <div key={row.id} style={{ ...S.card, marginBottom:16, border:"1.5px solid #f3f4f6" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:row.open?20:0, cursor:"pointer" }} onClick={() => toggleOpen(row.id)}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:28, height:28, background:"#7c3aed", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:12, fontWeight:800, color:"#fff" }}>{idx+1}</span>
              </div>
              <span style={{ fontSize:15, fontWeight:700, color:"#111827" }}>{row.countLabel}</span>
              <span style={{ background:"#7c3aed15", color:"#7c3aed", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{row.production_target_kg} kg/day</span>
              {row.result && <span style={{ background:"#ecfdf5", color:"#059669", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>✓ Calculated</span>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {rows.length>1 && <button className="remove-btn" onClick={e=>{e.stopPropagation();removeRow(row.id)}}><Trash2 size={12}/> Remove</button>}
              {row.open ? <ChevronUp size={16} color="#9ca3af"/> : <ChevronDown size={16} color="#9ca3af"/>}
            </div>
          </div>

          {row.open && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
                <div>
                  <label style={S.label}>Count Label</label>
                  <select style={S.select} value={row.countLabel} onChange={e => updateRow(row.id, "countLabel", e.target.value)}>
                    {Object.keys(PRESETS).map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                {[
                  ["Production Target (kg/day)", "production_target_kg"],
                  ["Nominal Count",              "nominal_count"],
                  ["Spindle Speed (RPM)",         "spindle_speed"],
                  ["TPI",                         "tpi"],
                  ["Efficiency (%)",              "efficiency_pct"],
                  ["Spindles / Machine",          "spindles_per_machine"],
                  ["Spinning Waste (%)",          "waste_pct"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={S.label}>{label}</label>
                    <input style={S.input} type="number" step="0.01" value={row[key]} onChange={e => updateRow(row.id, key, e.target.value)} />
                  </div>
                ))}
              </div>

              {row.error && <div style={{ background:"#fff1f2", color:"#e11d48", borderRadius:10, padding:"10px 14px", fontSize:13, marginBottom:12 }}>❌ {row.error}</div>}

              {row.result && (
                <div style={{ background:"#fafafa", borderRadius:14, padding:"16px 20px", border:"1px solid #f0f0f0" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>📊 Backend Results</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 32px" }}>
                    {[
                      ["Twist Multiplier (TM)",             row.result.twist_multiplier],
                      ["Production / Spindle / 8hr (gms)",  row.result.prod_per_spl_8hr_gms],
                      ["Production / Spindle / 24hr (gms)", row.result.prod_per_spl_24hr_gms],
                      ["Production / Frame / Day (kg)",     row.result.prod_per_frame_day_kg],
                      ["Spindles Required",                  row.result.spindles_required?.toLocaleString()],
                      ["Frames Required",                    row.result.frames_required],
                      ["Output incl. Waste (kg)",            row.result.output_with_waste_kg],
                      ["Cotton Bales / Day",                 row.result.bales_per_day],
                      ["Yarn Bags / Day",                    row.result.yarn_bags_per_day],
                      ["Yarn Bags / Month",                  row.result.yarn_bags_per_month?.toLocaleString()],
                    ].map(([k,v]) => (
                      <div key={k} style={S.resultRow}>
                        <span style={S.resultKey}>{k}</span>
                        <span style={S.resultVal}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <button style={S.addBtn} onClick={addRow}><Plus size={14}/> Add Yarn Count</button>
        <button style={S.calcBtn} onClick={calculate}><Calculator size={15}/> Calculate (Backend)</button>
        {calculated && (
          <>
            <input placeholder="Plan name (optional)" value={planName} onChange={e=>setPlanName(e.target.value)}
              style={{ ...S.input, width:200, padding:"11px 13px" }} />
            <button style={S.saveBtn} onClick={savePlan} disabled={saving}>
              <Save size={15}/> {saving?"Saving...":"Save to DB"}
            </button>
          </>
        )}
      </div>
      {saveMsg && <div style={{ fontSize:13, fontWeight:600, color:saveMsg.startsWith("✅")?"#059669":"#e11d48", marginBottom:16 }}>{saveMsg}</div>}

      {calculated && totals && (
        <div style={{ ...S.card, animation:"fadeUp .4s ease both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
            <CheckCircle size={18} color="#059669"/>
            <span style={{ fontSize:15, fontWeight:700, color:"#111827" }}>Production Summary</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            {[
              { label:"Total Frames",      val:totals.frames.toFixed(1),          color:"#7c3aed", bg:"#f5f3ff" },
              { label:"Total Spindles",    val:totals.spindles.toLocaleString(),   color:"#0284c7", bg:"#f0f9ff" },
              { label:"Cotton Bales/Day",  val:totals.bales.toFixed(1),           color:"#d97706", bg:"#fffbeb" },
              { label:"Yarn Bags/Day",     val:totals.bags.toLocaleString(),      color:"#059669", bg:"#ecfdf5" },
            ].map(({label,val,color,bg}) => (
              <div key={label} style={{ background:bg, borderRadius:14, padding:"16px 18px" }}>
                <div style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:26, fontWeight:800, color:"#111827" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"2px solid #f3f4f6" }}>
                  {["Count","Target (kg)","Frames","Spindles","Bales/Day","Bags/Day","Bags/Month"].map(h => (
                    <th key={h} style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", padding:"8px 12px", textAlign:"left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.filter(r=>r.result).map(r => (
                  <tr key={r.id} style={{ borderBottom:"1px solid #f9fafb" }}>
                    <td style={{ padding:"10px 12px", fontWeight:600, color:"#374151", fontSize:13 }}>{r.countLabel}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{r.production_target_kg}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{r.result.frames_required}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{parseFloat(r.result.spindles_required).toLocaleString()}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{r.result.bales_per_day}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{r.result.yarn_bags_per_day}</td>
                    <td style={{ padding:"10px 12px", fontSize:13 }}>{r.result.yarn_bags_per_month?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
