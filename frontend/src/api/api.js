// Central API service — all calls go through here
// Uses REACT_APP_API_BASE env var so dev hits localhost and prod hits Render
const BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000"

function token() { return localStorage.getItem("textile_token") }

async function req(method, path, body = null) {
  const headers = { "Content-Type": "application/json" }
  if (token()) headers["Authorization"] = `Bearer ${token()}`
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : null,
  })
  if (res.status === 401) { localStorage.removeItem("textile_token"); window.location.reload() }
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || "Request failed")
  return data
}

const get  = p      => req("GET",    p)
const post = (p, b) => req("POST",   p, b)
const patch= (p, b) => req("PATCH",  p, b)

// Auth
export const apiLogin    = (u, p) => post("/api/auth/login", { username: u, password: p })
export const apiGetMe    = ()     => get("/api/auth/me")

// Dashboard
export const apiWasteSummary = () => get("/api/waste/summary")
export const apiWasteAlerts  = () => get("/api/waste/alerts")
export const apiStockStatus  = () => get("/api/raw-material/stock-status")
export const apiYarnCounts   = () => get("/api/production/yarn-counts")
export const apiPlans        = () => get("/api/production/plans")

// Production
export const apiQuickCalc  = d => post("/api/production/calculate", d)
export const apiSavePlan   = d => post("/api/production/plans", d)

// Raw Material
export const apiInventory    = ()     => get("/api/raw-material/inventory")
export const apiAddTx        = d      => post("/api/raw-material/transaction", d)
export const apiCalcMaterial = d      => post("/api/raw-material/calculate-requirement", d)
export const apiUpdateStock  = (id,d) => patch(`/api/raw-material/inventory/${id}`, d)

// Waste
export const apiLogWaste    = d => post("/api/waste/log", d)
export const apiWasteLogs   = (fromDate, toDate) => {
  const params = new URLSearchParams();
  if (fromDate) params.append("from_date", fromDate);
  if (toDate)   params.append("to_date",   toDate);
  const qs = params.toString();
  return get(`/api/waste/logs${qs ? `?${qs}` : ""}`);
}

// Prediction
export const apiPredictProd  = d => post("/api/prediction/production", d)
export const apiPredictWaste = d => post("/api/prediction/waste", d)
export const apiModelInfo    = () => get("/api/prediction/model-info")
export const apiGenerateHistory = days => post(`/api/prediction/generate-history?days=${days}`)
export const apiAutoLog      = shift => post(`/api/prediction/auto-log${shift ? `?shift=${encodeURIComponent(shift)}` : ""}`)
export const apiTrainModel   = () => post("/api/prediction/train")
export const apiForecast7Day = (speed, eff, waste) => get(`/api/prediction/forecast/7day?spindle_speed=${speed}&efficiency_pct=${eff}&waste_pct=${waste}`)
export const apiForecastStages = (temp, hum, speed, eff) => get(`/api/prediction/forecast/stages?temperature_c=${temp}&humidity_pct=${hum}&spindle_speed=${speed}&efficiency_pct=${eff}`)
export const apiPredictionHistory = () => get("/api/prediction/history")
