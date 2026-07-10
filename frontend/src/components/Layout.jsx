import { useState, useEffect, useRef } from "react";
import {
  LayoutGrid, Factory, Droplets, Trash2, BrainCircuit, Zap,
  ChevronDown, Bell, Search, ChevronLeft, Settings, LogOut,
  X, User, Monitor, Save, CheckCircle,
  Factory as FactoryIcon, ChevronRight, CheckCheck
} from "lucide-react";

const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
function token() { return localStorage.getItem("textile_token"); }
async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  return res.ok ? res.json() : null;
}

const navItems = [
  { icon:LayoutGrid,   label:"Dashboard",          id:"dashboard" },
  { icon:Factory,      label:"Production Planning", id:"production" },
  { icon:Droplets,     label:"Raw Material",        id:"rawmaterial", hasChild:true },
  { icon:Trash2,       label:"Waste Monitoring",    id:"waste" },
  { icon:BrainCircuit, label:"AI Prediction",       id:"ai", hasChild:true },
];

// ── All searchable items in the app ──────────────────────────────
const SEARCH_INDEX = [
  // Pages
  { type:"page", label:"Dashboard",           desc:"KPIs, alerts, overview",            id:"dashboard",   icon:"🏠" },
  { type:"page", label:"Production Planning", desc:"Calculate yarn output, save plans",  id:"production",  icon:"🏭" },
  { type:"page", label:"Raw Material",        desc:"Cotton stock, transactions",         id:"rawmaterial", icon:"📦" },
  { type:"page", label:"Waste Monitoring",    desc:"Log and track waste per stage",      id:"waste",       icon:"♻️" },
  { type:"page", label:"AI Prediction",       desc:"ML forecast, 7-day production",      id:"ai",          icon:"🤖" },
  // Features
  { type:"feature", label:"Calculate Production",   desc:"Enter spindle speed & efficiency",  id:"production",  icon:"⚙️" },
  { type:"feature", label:"Save Production Plan",   desc:"Save calculations to database",     id:"production",  icon:"💾" },
  { type:"feature", label:"Log Waste Entry",        desc:"Manual waste log for a shift",      id:"waste",       icon:"📝" },
  { type:"feature", label:"Auto Generate Logs",     desc:"Simulate shift data automatically", id:"ai",          icon:"⚡" },
  { type:"feature", label:"Train ML Model",         desc:"Train RandomForest on waste data",  id:"ai",          icon:"🧠" },
  { type:"feature", label:"7-Day Forecast",         desc:"Predict production for next week",  id:"ai",          icon:"📅" },
  { type:"feature", label:"Stock IN / OUT",         desc:"Add or consume cotton stock",       id:"rawmaterial", icon:"🔄" },
  { type:"feature", label:"Cotton Requirement",     desc:"Calculate bales needed for target", id:"rawmaterial", icon:"🧮" },
  { type:"feature", label:"Waste Alerts",           desc:"View stages exceeding limits",      id:"waste",       icon:"🚨" },
  { type:"feature", label:"Stage Forecast",         desc:"Predict waste % for all 7 stages",  id:"ai",          icon:"📊" },
  // Stages
  { type:"info", label:"Blowroom Stage",   desc:"Limit: 1.2% — first cotton opening stage",  id:"waste", icon:"🌀" },
  { type:"info", label:"Carding Stage",    desc:"Limit: 4.5% — fibre alignment",              id:"waste", icon:"🌀" },
  { type:"info", label:"Combing Stage",    desc:"Limit: 14% — removes short fibres (Cbd)",    id:"waste", icon:"🌀" },
  { type:"info", label:"Drawing Stage",    desc:"Limit: 0.5% — fibre straightening",          id:"waste", icon:"🌀" },
  { type:"info", label:"Roving Stage",     desc:"Limit: 0.8% — pre-spinning attenuation",     id:"waste", icon:"🌀" },
  { type:"info", label:"Spinning Stage",   desc:"Limit: 3.25% — ring frame yarn production",  id:"waste", icon:"🌀" },
  { type:"info", label:"Winding Stage",    desc:"Limit: 0.5% — cone winding final step",      id:"waste", icon:"🌀" },
];

const SETTINGS_KEY = "textile_settings";
function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } }
function saveSettingsLS(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const DEFAULT_SETTINGS = {
  mill_name:"TextileAI Mill", shift_hours:8, spindles_per_frame:1008,
  limit_blowroom:1.2, limit_carding:4.5, limit_combing:14.0,
  limit_drawing:0.5, limit_roving:0.8, limit_spinning:3.25, limit_winding:0.5,
  alert_email:"", alert_waste:true, alert_stock:true, alert_sound:false,
  currency:"INR", date_format:"DD/MM/YYYY", auto_refresh:30,
  ai_model:"RandomForest", forecast_days:7, auto_train:false,
};

function ModelPerformancePanel() {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    apiFetch("/api/prediction/model-info").then(d => { if (d?.status === "trained") setMeta(d); });
  }, []);

  if (!meta) return (
    <div style={{ background:"#f5f3ff", borderRadius:14, padding:16, marginTop:20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Model Performance</div>
      <div style={{ fontSize:12, color:"#9ca3af" }}>No trained model found. Go to AI Prediction → Setup & Train.</div>
    </div>
  );

  const wasteRF  = meta.waste_results?.RandomForest?.r2  ?? "—";
  const wasteLR  = meta.waste_results?.LinearRegression?.r2 ?? "—";
  const prodRF   = meta.prod_results?.RandomForest?.r2   ?? "—";
  const prodLR   = meta.prod_results?.LinearRegression?.r2  ?? "—";

  return (
    <div style={{ background:"#f5f3ff", borderRadius:14, padding:16, marginTop:20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Model Performance</div>
      <div style={{ fontSize:11, color:"#9ca3af", marginBottom:10 }}>
        Trained on {meta.total_logs_used} logs • {new Date(meta.trained_at).toLocaleDateString()}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          ["Waste RF R²",      wasteRF,  wasteRF  >= 0.7 ? "#059669" : "#e11d48"],
          ["Waste LR R²",      wasteLR,  wasteLR  >= 0.7 ? "#059669" : "#e11d48"],
          ["Production RF R²", prodRF,   prodRF   >= 0.7 ? "#059669" : "#e11d48"],
          ["Production LR R²", prodLR,   prodLR   >= 0.7 ? "#059669" : "#e11d48"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:"#fff", borderRadius:10, padding:"10px 14px" }}>
            <div style={{ fontSize:10, color:"#9ca3af", fontWeight:600 }}>{label}</div>
            <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Layout({ children, activePage, onNavigate, onLogout }) {
  const [collapsed,     setCollapsed]     = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [settingsTab,   setSettingsTab]   = useState("mill");
  const [settings,      setSettings]      = useState({ ...DEFAULT_SETTINGS, ...loadSettings() });
  const [saved,         setSaved]          = useState(false);

  // Search state
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);

  // Bell / Notifications state
  const [showBell,      setShowBell]      = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notiLoading,   setNotiLoading]   = useState(false);
  const [readIds,       setReadIds]        = useState(() => {
    try { return JSON.parse(localStorage.getItem("read_noti") || "[]"); } catch { return []; }
  });
  const bellRef = useRef(null);

  // Profile state
  const [showProfile,   setShowProfile]   = useState(false);
  const [userInfo,      setUserInfo]       = useState(null);
  const profileRef = useRef(null);

  // ── Search logic ────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = SEARCH_INDEX.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(results);
  }, [searchQuery]);

  const handleSearchSelect = (item) => {
    onNavigate && onNavigate(item.id);
    setSearchQuery("");
    setSearchOpen(false);
  };

  // ── Load notifications (waste alerts + stock) ────────────────────
  const loadNotifications = async () => {
    setNotiLoading(true);
    try {
      const [alerts, stock] = await Promise.all([
        apiFetch("/api/waste/alerts"),
        apiFetch("/api/raw-material/stock-status"),
      ]);

      const nots = [];

      // Waste alerts → top 5
      if (Array.isArray(alerts)) {
        alerts.slice(0, 5).forEach((a, i) => {
          nots.push({
            id:      `waste_${i}`,
            type:    "waste",
            title:   `${a.stage} Waste Alert`,
            message: `${a.actual_pct?.toFixed(2)}% actual vs ${a.limit_pct}% limit (${a.shift})`,
            time:    a.date ? new Date(a.date).toLocaleTimeString() : "Recent",
            color:   "#e11d48",
            bg:      "#fff1f2",
            icon:    "⚠️",
          });
        });
      }

      // Stock alert
      if (stock) {
        stock.forEach((s, i) => {
          if (s.stock_kg < s.reorder_point_kg) {
            nots.push({
              id:      `stock_${i}`,
              type:    "stock",
              title:   "Low Cotton Stock",
              message: `${s.material_name}: ${s.stock_kg?.toLocaleString()} kg remaining (reorder at ${s.reorder_point_kg?.toLocaleString()} kg)`,
              time:    "Now",
              color:   "#d97706",
              bg:      "#fffbeb",
              icon:    "📦",
            });
          }
        });
      }

      if (nots.length === 0) {
        nots.push({
          id: "all_clear", type:"info",
          title: "All Clear",
          message: "No active alerts. All stages within limits.",
          time: "Now", color:"#059669", bg:"#ecfdf5", icon:"✅",
        });
      }

      setNotifications(nots);
    } catch {}
    setNotiLoading(false);
  };

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    setReadIds(ids);
    localStorage.setItem("read_noti", JSON.stringify(ids));
  };

  // ── Load user info ───────────────────────────────────────────────
  const loadUser = async () => {
    try {
      const u = await apiFetch("/api/auth/me");
      setUserInfo(u);
    } catch {}
  };

  // ── Close dropdowns on outside click ────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current    && !bellRef.current.contains(e.target))    setShowBell(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (searchRef.current  && !searchRef.current.contains(e.target))  setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateSetting = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    saveSettingsLS(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const S = {
    label:   { fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:5 },
    input:   { width:"100%", background:"#f9fafb", border:"1.5px solid #e5e7eb", borderRadius:10, padding:"9px 12px", fontSize:13, fontWeight:500, color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif" },
    row:     { marginBottom:16 },
    grid2:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
    secTitle:{ fontSize:12, fontWeight:800, color:"#111827", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14, paddingBottom:8, borderBottom:"1.5px solid #f3f4f6" },
    toggle:  (on) => ({ width:42, height:24, borderRadius:99, background:on?"#111827":"#e5e7eb", position:"relative", cursor:"pointer", transition:"background .2s", border:"none", flexShrink:0 }),
    dot:     (on) => ({ position:"absolute", top:3, left:on?21:3, width:18, height:18, borderRadius:99, background:"#fff", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }),
    tRow:    { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f3f4f6" },
  };

  const STABS = [
    { id:"mill",    label:"Mill Info",    icon:FactoryIcon },
    { id:"waste",   label:"Waste Limits", icon:Trash2 },
    { id:"alerts",  label:"Alerts",       icon:Bell },
    { id:"display", label:"Display",      icon:Monitor },
    { id:"ai",      label:"AI & Model",   icon:BrainCircuit },
    { id:"account", label:"Account",      icon:User },
  ];

  const typeColor = { page:"#7c3aed", feature:"#0284c7", info:"#059669" };
  const typeBg    = { page:"#f5f3ff",  feature:"#f0f9ff",  info:"#ecfdf5" };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#F3F3F0", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        .nav-item{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:16px;cursor:pointer;transition:background .2s;margin-bottom:3px;}
        .nav-item:hover{background:rgba(255,255,255,0.65);}
        .nav-item.active{background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.07);}
        .nav-label{font-size:13.5px;font-weight:500;color:#6b7280;}
        .nav-item.active .nav-label{color:#111827;font-weight:600;}
        .si{border:none;background:none;outline:none;width:100%;font-family:'DM Sans',sans-serif;font-size:13.5px;color:#374151;}
        .si::placeholder{color:#9ca3af;}
        .sr-item{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-radius:10px;transition:background .15s;}
        .sr-item:hover{background:#f3f4f6;}
        .stab{padding:9px 14px;border-radius:10px;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;transition:all .18s;width:100%;text-align:left;}
        .stab:hover{background:#f3f4f6;}
        .si-in:focus{border-color:#111827!important;box-shadow:0 0 0 3px rgba(17,24,39,0.08);}
        @keyframes slideIn{from{opacity:0;transform:scale(0.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes dropDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{ width:collapsed?72:256, flexShrink:0, padding:"22px 14px", display:"flex", flexDirection:"column", height:"100vh", position:"sticky", top:0, transition:"width .3s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 10px", marginBottom:32 }}>
          <div style={{ width:36, height:36, background:"#FACC15", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 8px rgba(250,204,21,0.4)" }}>
            <Zap size={18} color="#111827"/>
          </div>
          {!collapsed && <span style={{ fontSize:17, fontWeight:800, color:"#111827", whiteSpace:"nowrap" }}>TextileAI</span>}
        </div>

        <nav style={{ flex:1 }}>
          {navItems.map(({ icon:Icon, label, id, hasChild }) => (
            <div key={id} className={`nav-item${activePage===id?" active":""}`} onClick={() => onNavigate?.(id)}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Icon size={18} color={activePage===id?"#111827":"#9ca3af"}/>
                {!collapsed && <span className="nav-label">{label}</span>}
              </div>
              {!collapsed && hasChild && <ChevronDown size={14} color="#9ca3af"/>}
            </div>
          ))}
        </nav>

        <div className="nav-item" onClick={() => setShowSettings(true)}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Settings size={18} color="#9ca3af"/>
            {!collapsed && <span className="nav-label">Settings</span>}
          </div>
        </div>

        <div className="nav-item" onClick={onLogout} style={{ marginTop:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <LogOut size={18} color="#e11d48"/>
            {!collapsed && <span style={{ fontSize:"13.5px", fontWeight:500, color:"#e11d48" }}>Logout</span>}
          </div>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} style={{ marginTop:10, width:36, height:36, background:"#fff", border:"none", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", alignSelf:"center" }}>
          <ChevronLeft size={15} color="#6b7280" style={{ transform:collapsed?"rotate(180deg)":"none", transition:"transform .3s" }}/>
        </button>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main style={{ flex:1, padding:"28px 32px", overflowY:"auto" }}>
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>

          {/* ── Search Bar ── */}
          <div ref={searchRef} style={{ position:"relative", width:380 }}>
            <div style={{ display:"flex", alignItems:"center", background:"#fff", borderRadius:14, padding:"9px 16px", gap:10, boxShadow:"0 2px 8px rgba(0,0,0,0.05)", border:`1.5px solid ${searchOpen?"#111827":"transparent"}`, transition:"border .2s" }}>
              <Search size={15} color="#9ca3af" style={{ flexShrink:0 }}/>
              <input
                className="si"
                placeholder="Search pages, features, stages..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex" }}>
                  <X size={13} color="#9ca3af"/>
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchOpen && (
              <div style={{ position:"absolute", top:"calc(100% + 8px)", left:0, right:0, background:"#fff", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:500, overflow:"hidden", border:"1.5px solid #f3f4f6", animation:"dropDown .18s ease" }}>
                {searchQuery.trim() === "" ? (
                  <div style={{ padding:"12px 14px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Quick Navigate</div>
                    {navItems.map(({ icon:Icon, label, id }) => (
                      <div key={id} className="sr-item" onClick={() => handleSearchSelect({ id, label })}>
                        <Icon size={15} color="#6b7280"/>
                        <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{label}</span>
                        <ChevronRight size={13} color="#d1d5db" style={{ marginLeft:"auto" }}/>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                    No results for "<strong>{searchQuery}</strong>"
                  </div>
                ) : (
                  <div style={{ padding:"8px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", padding:"4px 6px 8px" }}>
                      {searchResults.length} result{searchResults.length!==1?"s":""}
                    </div>
                    {searchResults.map((item, i) => (
                      <div key={i} className="sr-item" onClick={() => handleSearchSelect(item)}>
                        <span style={{ fontSize:18, width:28, textAlign:"center" }}>{item.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{item.label}</div>
                          <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{item.desc}</div>
                        </div>
                        <span style={{ background:typeBg[item.type], color:typeColor[item.type], borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {item.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>

            {/* ── Bell ── */}
            <div ref={bellRef} style={{ position:"relative" }}>
              <button
                onClick={() => { setShowBell(v => !v); if (!showBell) loadNotifications(); }}
                style={{ width:38, height:38, background:"#fff", border:"none", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", position:"relative" }}>
                <Bell size={15} color="#6b7280"/>
                {unreadCount > 0 && (
                  <span style={{ position:"absolute", top:6, right:6, width:8, height:8, background:"#e11d48", borderRadius:99, border:"2px solid #fff" }}/>
                )}
              </button>

              {showBell && (
                <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:340, background:"#fff", borderRadius:18, boxShadow:"0 12px 40px rgba(0,0,0,0.14)", zIndex:500, overflow:"hidden", border:"1.5px solid #f3f4f6", animation:"dropDown .18s ease" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1.5px solid #f3f4f6" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:"#111827" }}>
                      Notifications {unreadCount > 0 && <span style={{ background:"#e11d48", color:"#fff", borderRadius:99, padding:"1px 7px", fontSize:10, marginLeft:6 }}>{unreadCount}</span>}
                    </div>
                    <button onClick={markAllRead} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:700, color:"#6b7280", display:"flex", alignItems:"center", gap:4 }}>
                      <CheckCheck size={13}/> Mark all read
                    </button>
                  </div>

                  <div style={{ maxHeight:320, overflowY:"auto" }}>
                    {notiLoading ? (
                      <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>Loading...</div>
                    ) : notifications.map(n => (
                      <div key={n.id} style={{ display:"flex", gap:12, padding:"12px 16px", borderBottom:"1px solid #f9fafb", background: readIds.includes(n.id) ? "#fff" : "#fafafa", cursor:"pointer" }}
                        onClick={() => { onNavigate?.(n.type === "waste" ? "waste" : "rawmaterial"); setShowBell(false); }}>
                        <div style={{ width:36, height:36, background:n.bg, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{n.icon}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:n.color }}>{n.title}</div>
                            <div style={{ fontSize:10, color:"#9ca3af", flexShrink:0, marginLeft:8 }}>{n.time}</div>
                          </div>
                          <div style={{ fontSize:11, color:"#6b7280", marginTop:2, lineHeight:1.4 }}>{n.message}</div>
                        </div>
                        {!readIds.includes(n.id) && <div style={{ width:7, height:7, background:"#e11d48", borderRadius:99, marginTop:5, flexShrink:0 }}/>}
                      </div>
                    ))}
                  </div>

                  <div style={{ padding:"10px 16px", borderTop:"1.5px solid #f3f4f6" }}>
                    <button onClick={() => { onNavigate?.("waste"); setShowBell(false); }}
                      style={{ width:"100%", background:"#f3f4f6", border:"none", borderRadius:10, padding:"9px", fontSize:12, fontWeight:700, color:"#374151", cursor:"pointer" }}>
                      View All Waste Alerts →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Profile Avatar ── */}
            <div ref={profileRef} style={{ position:"relative" }}>
              <div
                onClick={() => { setShowProfile(v => !v); if (!userInfo) loadUser(); }}
                style={{ width:38, height:38, borderRadius:11, background:"linear-gradient(135deg,#facc15,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:14, boxShadow:"0 2px 8px rgba(249,115,22,0.3)", cursor:"pointer" }}>
                {userInfo?.username?.[0]?.toUpperCase() || "T"}
              </div>

              {showProfile && (
                <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:240, background:"#fff", borderRadius:18, boxShadow:"0 12px 40px rgba(0,0,0,0.14)", zIndex:500, overflow:"hidden", border:"1.5px solid #f3f4f6", animation:"dropDown .18s ease" }}>
                  {/* Profile Header */}
                  <div style={{ padding:"16px", background:"linear-gradient(135deg,#facc15,#f97316)", textAlign:"center" }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:"rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:20, margin:"0 auto 8px" }}>
                      {userInfo?.username?.[0]?.toUpperCase() || "T"}
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{userInfo?.full_name || userInfo?.username || "Admin"}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.85)" }}>{userInfo?.email || "admin@textileai.com"}</div>
                    <div style={{ background:"rgba(255,255,255,0.25)", borderRadius:99, padding:"2px 10px", fontSize:10, fontWeight:700, color:"#fff", display:"inline-block", marginTop:6 }}>
                      {userInfo?.role?.toUpperCase() || "ADMIN"}
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div style={{ padding:"8px" }}>
                    {[
                      { icon:"⚙️", label:"Settings",       action:() => { setShowProfile(false); setShowSettings(true); } },
                      { icon:"🏭", label:"Mill Dashboard",  action:() => { onNavigate?.("dashboard"); setShowProfile(false); } },
                      { icon:"🤖", label:"AI Prediction",   action:() => { onNavigate?.("ai"); setShowProfile(false); } },
                    ].map(({ icon, label, action }) => (
                      <div key={label} className="sr-item" onClick={action}>
                        <span style={{ fontSize:15 }}>{icon}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{label}</span>
                        <ChevronRight size={13} color="#d1d5db" style={{ marginLeft:"auto" }}/>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop:"1.5px solid #f3f4f6", padding:"8px" }}>
                    <div className="sr-item" onClick={() => { setShowProfile(false); onLogout?.(); }}
                      style={{ color:"#e11d48" }}>
                      <LogOut size={15} color="#e11d48"/>
                      <span style={{ fontSize:13, fontWeight:700, color:"#e11d48" }}>Logout</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </main>

      {/* ── Settings Modal ───────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if(e.target===e.currentTarget) setShowSettings(false); }}>
          <div style={{ background:"#fff", borderRadius:24, width:"100%", maxWidth:820, maxHeight:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,0.2)", animation:"slideIn .25s ease" }}>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 28px", borderBottom:"1.5px solid #f3f4f6" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, background:"#111827", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Settings size={18} color="#fff"/>
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#111827" }}>Settings</div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>Manage your mill configuration</div>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} style={{ width:34, height:34, background:"#f3f4f6", border:"none", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={16} color="#6b7280"/>
              </button>
            </div>

            <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
              <div style={{ width:190, borderRight:"1.5px solid #f3f4f6", padding:"16px 12px", display:"flex", flexDirection:"column", gap:3, flexShrink:0 }}>
                {STABS.map(({ id, label, icon:Icon }) => (
                  <button key={id} className="stab"
                    style={{ background:settingsTab===id?"#111827":"transparent", color:settingsTab===id?"#fff":"#6b7280" }}
                    onClick={() => setSettingsTab(id)}>
                    <Icon size={14}/> {label}
                  </button>
                ))}
              </div>

              <div style={{ flex:1, padding:"24px 28px", overflowY:"auto" }}>

                {settingsTab === "mill" && (
                  <div>
                    <div style={S.secTitle}>Mill Information</div>
                    <div style={S.grid2}>
                      {[["Mill Name","mill_name","text"],["Shift Hours","shift_hours","number"],["Spindles per Frame","spindles_per_frame","number"]].map(([label,key,type])=>(
                        <div key={key} style={S.row}>
                          <label style={S.label}>{label}</label>
                          <input className="si-in" style={S.input} type={type} value={settings[key]} onChange={e=>updateSetting(key,type==="number"?+e.target.value:e.target.value)}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab === "waste" && (
                  <div>
                    <div style={S.secTitle}>Waste % Limits per Stage</div>
                    <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#92400e" }}>
                      ⚠️ <strong>UI display only.</strong> These values update the dashboard display. Backend alert thresholds are set in <code style={{ background:"#fef3c7", borderRadius:4, padding:"1px 5px" }}>calculations.py → NORMAL_WASTE_LIMITS</code> and require a server restart to change.
                    </div>
                    <div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>Alerts trigger when actual waste exceeds these limits.</div>
                    <div style={S.grid2}>
                      {[["Blowroom","limit_blowroom"],["Carding","limit_carding"],["Combing","limit_combing"],["Drawing","limit_drawing"],["Roving","limit_roving"],["Spinning","limit_spinning"],["Winding","limit_winding"]].map(([label,key])=>(
                        <div key={key} style={S.row}>
                          <label style={S.label}>{label} (%)</label>
                          <input className="si-in" style={S.input} type="number" step="0.1" value={settings[key]} onChange={e=>updateSetting(key,+e.target.value)}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab === "alerts" && (
                  <div>
                    <div style={S.secTitle}>Alert Configuration</div>
                    <div style={S.row}>
                      <label style={S.label}>Alert Email</label>
                      <input className="si-in" style={S.input} type="email" placeholder="supervisor@mill.com" value={settings.alert_email} onChange={e=>updateSetting("alert_email",e.target.value)}/>
                    </div>
                    {[["alert_waste","Waste Alerts","Notify when waste exceeds stage limits"],["alert_stock","Low Stock Alerts","Notify when cotton falls below reorder point"],["alert_sound","Sound Notifications","Play sound when alert is triggered"]].map(([key,label,desc])=>(
                      <div key={key} style={S.tRow}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{label}</div>
                          <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{desc}</div>
                        </div>
                        <button style={S.toggle(settings[key])} onClick={()=>updateSetting(key,!settings[key])}>
                          <div style={S.dot(settings[key])}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {settingsTab === "display" && (
                  <div>
                    <div style={S.secTitle}>Display Preferences</div>
                    <div style={S.grid2}>
                      <div style={S.row}>
                        <label style={S.label}>Currency</label>
                        <select className="si-in" style={S.input} value={settings.currency} onChange={e=>updateSetting("currency",e.target.value)}>
                          <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option>
                        </select>
                      </div>
                      <div style={S.row}>
                        <label style={S.label}>Date Format</label>
                        <select className="si-in" style={S.input} value={settings.date_format} onChange={e=>updateSetting("date_format",e.target.value)}>
                          <option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option>
                        </select>
                      </div>
                      <div style={S.row}>
                        <label style={S.label}>Dashboard Auto-Refresh</label>
                        <select className="si-in" style={S.input} value={settings.auto_refresh} onChange={e=>updateSetting("auto_refresh",+e.target.value)}>
                          <option value={0}>Off</option><option value={15}>15s</option><option value={30}>30s</option><option value={60}>1 min</option><option value={300}>5 min</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === "ai" && (
                  <div>
                    <div style={S.secTitle}>AI & Model Settings</div>
                    <div style={S.grid2}>
                      <div style={S.row}>
                        <label style={S.label}>Preferred Model</label>
                        <select className="si-in" style={S.input} value={settings.ai_model} onChange={e=>updateSetting("ai_model",e.target.value)}>
                          <option>RandomForest</option><option>LinearRegression</option>
                        </select>
                      </div>
                      <div style={S.row}>
                        <label style={S.label}>Forecast Days</label>
                        <select className="si-in" style={S.input} value={settings.forecast_days} onChange={e=>updateSetting("forecast_days",+e.target.value)}>
                          <option value={7}>7 Days</option><option value={14}>14 Days</option><option value={30}>30 Days</option>
                        </select>
                      </div>
                    </div>
                    <div style={S.tRow}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>Auto Re-train Model</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Retrain automatically when 500+ new logs are added</div>
                      </div>
                      <button style={S.toggle(settings.auto_train)} onClick={()=>updateSetting("auto_train",!settings.auto_train)}>
                        <div style={S.dot(settings.auto_train)}/>
                      </button>
                    </div>
                    <ModelPerformancePanel />
                  </div>
                )}

                {settingsTab === "account" && (
                  <div>
                    <div style={S.secTitle}>Account</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14, background:"#f9fafb", borderRadius:14, padding:16, marginBottom:20 }}>
                      <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#facc15,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:20 }}>
                        {userInfo?.username?.[0]?.toUpperCase() || "T"}
                      </div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#111827" }}>{userInfo?.full_name || userInfo?.username || "Admin"}</div>
                        <div style={{ fontSize:12, color:"#9ca3af" }}>{userInfo?.email || "admin@textileai.com"}</div>
                        <div style={{ background:"#d1fae5", color:"#065f46", borderRadius:99, padding:"2px 8px", fontSize:10, fontWeight:700, display:"inline-block", marginTop:4 }}>{userInfo?.role?.toUpperCase() || "ADMIN"}</div>
                      </div>
                    </div>
                    <div style={S.row}>
                      <label style={S.label}>New Password</label>
                      <input className="si-in" style={S.input} type="password" placeholder="Leave blank to keep current"/>
                    </div>
                    <div style={S.row}>
                      <label style={S.label}>Confirm Password</label>
                      <input className="si-in" style={S.input} type="password" placeholder="Confirm new password"/>
                    </div>
                    <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:12, padding:"12px 16px", marginTop:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#c2410c" }}>⚠ Danger Zone</div>
                      <div style={{ fontSize:12, color:"#9a3412", marginTop:4, marginBottom:10 }}>These actions cannot be undone.</div>
                      <button style={{ background:"#fff", border:"1.5px solid #fca5a5", borderRadius:9, padding:"7px 14px", fontSize:12, fontWeight:700, color:"#e11d48", cursor:"pointer" }}>
                        Clear All Prediction Logs
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div style={{ padding:"16px 28px", borderTop:"1.5px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fafafa" }}>
              <div style={{ fontSize:12, color:"#9ca3af" }}>Settings saved to browser storage</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowSettings(false)} style={{ background:"#f3f4f6", border:"none", borderRadius:11, padding:"9px 20px", fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer" }}>Cancel</button>
                <button onClick={handleSave} style={{ background:saved?"#059669":"#111827", border:"none", borderRadius:11, padding:"9px 22px", fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:7, transition:"background .3s" }}>
                  {saved ? <><CheckCircle size={14}/> Saved!</> : <><Save size={14}/> Save Settings</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}