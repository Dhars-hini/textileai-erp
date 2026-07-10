import { useState, useEffect } from "react";
import { Package, AlertTriangle, TrendingDown, CheckCircle, RefreshCw, Plus } from "lucide-react";
import { apiCalcMaterial, apiInventory, apiAddTx, apiStockStatus } from "../api/api";

const S = {
  title:  { fontSize:"2.6rem", fontWeight:800, color:"#111827", margin:"0 0 28px 0", lineHeight:1 },
  card:   { background:"#fff", borderRadius:20, boxShadow:"0 2px 18px rgba(0,0,0,0.05)", padding:24, marginBottom:20 },
  label:  { fontSize:12, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5, display:"block" },
  input:  { width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"9px 13px", fontSize:14, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif" },
  calcBtn:{ background:"linear-gradient(135deg,#0284c7,#0369a1)", color:"#fff", border:"none", borderRadius:13, padding:"12px 28px", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(2,132,199,0.35)", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" },
};

const COUNTS = ["40s Cbd Hsy","40s Cbd Warp","30s Cbd Hsy","24s Cbd Hsy"];

export default function RawMaterial() {
  const [form, setForm] = useState({ productionKg:17900, wastePercent:3.25, cardingWaste:4.5, blowroomWaste:1.2, combingWaste:14, baleWeight:165 });
  const [result, setResult]     = useState(null);
  const [inventory, setInv]     = useState([]);
  const [stock, setStock]       = useState([]);
  const [txForm, setTxForm]     = useState({ type:"IN", qty:"", note:"" });
  const [txMsg, setTxMsg]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [countMix, setCountMix] = useState([
    { count:"40s Cbd Hsy", share:27 },{ count:"40s Cbd Warp", share:22 },
    { count:"30s Cbd Hsy", share:28 },{ count:"24s Cbd Hsy", share:23 },
  ]);

  useEffect(() => { loadInventory(); }, []);

  const loadInventory = async () => {
    try {
      const [inv, st] = await Promise.all([apiInventory(), apiStockStatus()]);
      setInv(inv); setStock(st);
    } catch(e) { console.error(e); }
  };

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await apiCalcMaterial({
        production_target_kg: parseFloat(form.productionKg),
        spinning_waste_pct:   parseFloat(form.wastePercent),
        carding_waste_pct:    parseFloat(form.cardingWaste),
        blowroom_waste_pct:   parseFloat(form.blowroomWaste),
        combing_waste_pct:    parseFloat(form.combingWaste),
        avg_bale_weight:      parseFloat(form.baleWeight),
      });
      // enrich with frontend mix breakdown
      const totalWaste = (parseFloat(form.wastePercent)+parseFloat(form.cardingWaste)+parseFloat(form.blowroomWaste)+parseFloat(form.combingWaste))/100;
      const breakdown = countMix.map(({count,share}) => {
        const kg = parseFloat(form.productionKg)*share/100;
        const cotton = kg/(1-totalWaste);
        return { count, share, kg:kg.toFixed(0), cotton:cotton.toFixed(1), bales:(cotton/parseFloat(form.baleWeight)).toFixed(1) };
      });
      const cotton = stock.find(s=>s.material_name==="Cotton Bales");
      const stockKg = cotton?.stock_kg ?? 0;
      const reorderKg = cotton?.reorder_point_kg ?? 3000;
      const daysOfStock = (stockKg/res.cotton_required_kg).toFixed(1);
      const status = stockKg>=reorderKg?"ok":stockKg>=reorderKg*0.5?"warn":"critical";
      setResult({ ...res, breakdown, daysOfStock, status, stockKg, reorderKg });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const addTransaction = async () => {
    const inv = inventory[0];
    if (!inv || !txForm.qty) return;
    setTxMsg("");
    try {
      await apiAddTx({ inventory_id:inv.id, transaction_type:txForm.type, quantity_kg:parseFloat(txForm.qty), reference_note:txForm.note });
      setTxMsg(`✅ ${txForm.type === "IN" ? "Added" : "Removed"} ${txForm.qty} kg successfully`);
      setTxForm({ type:"IN", qty:"", note:"" });
      loadInventory();
    } catch(e) { setTxMsg("❌ " + e.message); }
  };

  const statusColors = { ok:{bg:"#ecfdf5",color:"#059669",label:"Stock OK"}, warn:{bg:"#fffbeb",color:"#d97706",label:"Low Stock Warning"}, critical:{bg:"#fff1f2",color:"#e11d48",label:"Critical — Reorder Now"} };

  return (
    <div style={{ animation:"fadeUp 0.45s ease both" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} input:focus{border-color:#0284c7!important;}`}</style>
      <h1 style={S.title}>Raw Material Planning</h1>

      {/* Live stock status from DB */}
      {stock.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
          {stock.map(s => (
            <div key={s.id} style={{ background:s.status==="ok"?"#ecfdf5":s.status==="warn"?"#fffbeb":"#fff1f2", borderRadius:16, padding:"16px 18px", border:`1.5px solid ${s.status==="ok"?"#d1fae5":s.status==="warn"?"#fde68a":"#fecdd3"}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:s.status==="ok"?"#059669":s.status==="warn"?"#d97706":"#e11d48", textTransform:"uppercase", marginBottom:6 }}>{s.material_name}</div>
              <div style={{ fontSize:22, fontWeight:800, color:"#111827" }}>{s.stock_kg?.toLocaleString()} kg</div>
              <div style={{ fontSize:11, color:"#6b7280", marginTop:4 }}>Reorder at {s.reorder_point_kg?.toLocaleString()} kg • {s.status.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stock Transaction */}
      <div style={{ ...S.card, border:"1.5px solid #bae6fd", marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#111827", marginBottom:16 }}>📦 Update Cotton Stock</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr auto", gap:12, alignItems:"flex-end" }}>
          <div>
            <label style={S.label}>Type</label>
            <select style={S.input} value={txForm.type} onChange={e=>setTxForm(p=>({...p,type:e.target.value}))}>
              <option value="IN">Stock IN (Received)</option>
              <option value="OUT">Stock OUT (Used)</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Quantity (kg)</label>
            <input style={S.input} type="number" placeholder="e.g. 1650" value={txForm.qty} onChange={e=>setTxForm(p=>({...p,qty:e.target.value}))} />
          </div>
          <div>
            <label style={S.label}>Reference Note</label>
            <input style={S.input} type="text" placeholder="e.g. Supplier delivery batch #12" value={txForm.note} onChange={e=>setTxForm(p=>({...p,note:e.target.value}))} />
          </div>
          <button onClick={addTransaction} style={{ ...S.calcBtn, whiteSpace:"nowrap", padding:"10px 20px" }}><Plus size={14}/> Add</button>
        </div>
        {txMsg && <div style={{ marginTop:12, fontSize:13, fontWeight:600, color:txMsg.startsWith("✅")?"#059669":"#e11d48" }}>{txMsg}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Inputs */}
        <div>
          <div style={S.card}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <div style={{ width:32, height:32, background:"#0284c7", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}><Package size={16} color="#fff"/></div>
              <span style={{ fontSize:15, fontWeight:700, color:"#111827" }}>Production & Waste Inputs</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {[
                ["Total Production Target (kg/day)","productionKg"],
                ["Spinning Waste (%)",               "wastePercent"],
                ["Carding Waste (%)",                "cardingWaste"],
                ["Blowroom Waste (%)",               "blowroomWaste"],
                ["Combing Waste (%)",                "combingWaste"],
                ["Avg Bale Weight (kg)",             "baleWeight"],
              ].map(([label,key]) => (
                <div key={key}>
                  <label style={S.label}>{label}</label>
                  <input style={S.input} type="number" step="0.01" value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize:13, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:16 }}>Count Mix (%)</div>
            {countMix.map((item,i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px", gap:10, marginBottom:10 }}>
                <div style={{ background:"#F8F8F6", borderRadius:11, padding:"9px 13px", fontSize:13, fontWeight:600, color:"#374151" }}>{item.count}</div>
                <input style={{ ...S.input, textAlign:"center" }} type="number" max="100" value={item.share}
                  onChange={e => { const m=[...countMix]; m[i]={...m[i],share:e.target.value}; setCountMix(m); }} />
              </div>
            ))}
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>Total should add up to 100%</div>
          </div>
          <button style={S.calcBtn} onClick={calculate} disabled={loading}>
            <RefreshCw size={15}/> {loading?"Calculating...":"Calculate (Backend)"}
          </button>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <>
              <div style={{ ...S.card, background:statusColors[result.status].bg, border:`1.5px solid ${statusColors[result.status].color}30` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {result.status==="ok" ? <CheckCircle size={20} color="#059669"/> : <AlertTriangle size={20} color={statusColors[result.status].color}/>}
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:statusColors[result.status].color }}>{statusColors[result.status].label}</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{result.status==="ok" ? `${result.daysOfStock} days of stock available` : `Stock: ${result.stockKg?.toLocaleString()} kg — Reorder at ${result.reorderKg?.toLocaleString()} kg`}</div>
                  </div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
                {[
                  { label:"Cotton Required/Day",  val:parseFloat(result.cotton_required_kg).toLocaleString()+" kg", color:"#0284c7", bg:"#f0f9ff" },
                  { label:"Bales Required/Day",   val:result.bales_required,                                         color:"#d97706", bg:"#fffbeb" },
                  { label:"Monthly Cotton Req.",  val:parseFloat(result.monthly_cotton_kg).toLocaleString()+" kg",  color:"#7c3aed", bg:"#f5f3ff" },
                  { label:"Monthly Bales Req.",   val:result.monthly_bales,                                          color:"#059669", bg:"#ecfdf5" },
                  { label:"Total Waste %",        val:result.total_waste_pct+"%",                                    color:"#e11d48", bg:"#fff1f2" },
                  { label:"Stock Covers",         val:result.daysOfStock+" days",                                    color:"#0891b2", bg:"#ecfeff" },
                ].map(({label,val,color,bg}) => (
                  <div key={label} style={{ background:bg, borderRadius:14, padding:"14px 16px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:"#111827" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={{ fontSize:13, fontWeight:700, color:"#111827", marginBottom:14 }}>Per Count Breakdown</div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>{["Count","Share","Yarn (kg)","Cotton (kg)","Bales"].map(h=><th key={h} style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", padding:"6px 10px", textAlign:"left", borderBottom:"2px solid #f3f4f6" }}>{h}</th>)}</tr></thead>
                  <tbody>{result.breakdown.map(b=>(
                    <tr key={b.count} style={{ borderBottom:"1px solid #f9fafb" }}>
                      <td style={{ padding:"9px 10px", fontSize:13, fontWeight:600, color:"#374151" }}>{b.count}</td>
                      <td style={{ padding:"9px 10px", fontSize:13 }}>{b.share}%</td>
                      <td style={{ padding:"9px 10px", fontSize:13 }}>{parseInt(b.kg).toLocaleString()}</td>
                      <td style={{ padding:"9px 10px", fontSize:13 }}>{parseFloat(b.cotton).toLocaleString()}</td>
                      <td style={{ padding:"9px 10px", fontSize:13 }}>{b.bales}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ ...S.card, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:300, textAlign:"center" }}>
              <TrendingDown size={40} color="#d1d5db" style={{ marginBottom:14 }}/>
              <div style={{ fontSize:15, fontWeight:600, color:"#9ca3af" }}>Enter inputs and click Calculate</div>
              <div style={{ fontSize:13, color:"#d1d5db", marginTop:6 }}>Results come from backend API</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
