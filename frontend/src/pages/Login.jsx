import { useState } from "react";
import { Zap } from "lucide-react";
import { apiLogin } from "../api/api";

export default function Login({ onLogin }) {
  const [form, setForm]       = useState({ username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.username || !form.password) { setError("Enter username and password"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiLogin(form.username, form.password);
      localStorage.setItem("textile_token", data.access_token);
      onLogin();
    } catch (e) { setError(e.message || "Invalid credentials"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#F3F3F0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background:"#fff", borderRadius:24, padding:"44px 40px", width:400, boxShadow:"0 8px 40px rgba(0,0,0,0.09)", animation:"fadeUp .4s ease both" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:36 }}>
          <div style={{ width:42, height:42, background:"#FACC15", borderRadius:13, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 10px rgba(250,204,21,0.4)" }}>
            <Zap size={22} color="#111827" />
          </div>
          <span style={{ fontSize:22, fontWeight:800, color:"#111827" }}>TextileAI ERP</span>
        </div>

        <div style={{ fontSize:24, fontWeight:800, color:"#111827", marginBottom:4 }}>Welcome back</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:28 }}>Sign in to continue</div>

        {error && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#e11d48", marginBottom:18 }}>{error}</div>}

        {[["Username","text","username","admin"],["Password","password","password","••••••••"]].map(([label,type,key,ph]) => (
          <div key={key} style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:6 }}>{label}</label>
            <input type={type} placeholder={ph}
              style={{ width:"100%", background:"#F8F8F6", border:"1.5px solid #e5e7eb", borderRadius:11, padding:"11px 14px", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", color:"#111827" }}
              value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
        ))}

        <button onClick={handleLogin} disabled={loading}
          style={{ width:"100%", background:"linear-gradient(135deg,#111827,#374151)", color:"#fff", border:"none", borderRadius:12, padding:"13px", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ marginTop:18, padding:"11px 14px", background:"#f9fafb", borderRadius:10, fontSize:12, color:"#6b7280", textAlign:"center" }}>
          Default login: <strong>admin</strong> / <strong>admin123</strong>
        </div>
      </div>
    </div>
  );
}
