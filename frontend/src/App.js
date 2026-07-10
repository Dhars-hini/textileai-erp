import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProductionPlanning from "./pages/ProductionPlanning";
import RawMaterial from "./pages/RawMaterial";
import WasteMonitoring from "./pages/WasteMonitoring";
import AIPrediction from "./pages/Prediction";

export default function App() {
  const [page, setPage]       = useState("dashboard");
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("textile_token"));

  useEffect(() => { setLoggedIn(!!localStorage.getItem("textile_token")); }, []);

  const handleLogout = () => { localStorage.removeItem("textile_token"); setLoggedIn(false); };

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  const pages = { dashboard:<Dashboard/>, production:<ProductionPlanning/>, rawmaterial:<RawMaterial/>, waste:<WasteMonitoring/>, ai:<AIPrediction/> };

  return (
    <Layout activePage={page} onNavigate={setPage} onLogout={handleLogout}>
      {pages[page] || <Dashboard/>}
      
    </Layout>
    
    
  );
}
