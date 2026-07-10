import numpy as np
import joblib
from fastapi import APIRouter
from types import SimpleNamespace
import os

from app.ml_model import predict_waste_ml as predict_waste
from app.ml_model import predict_production_ml as predict_production

router = APIRouter(tags=["optimize"])

# -------------------------
# 🔹 LOAD / INIT Q-TABLE
# -------------------------
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models_trained", "rl_q_table.pkl")

if os.path.exists(MODEL_PATH):
    q_table = joblib.load(MODEL_PATH)
else:
    q_table = {}

# -------------------------
# 🔹 ACTIONS
# -------------------------
actions_map = {
    0: "Increase Speed",
    1: "Decrease Speed",
    2: "Increase Humidity",
    3: "Decrease Humidity",
    4: "Increase Efficiency",
    5: "Decrease Efficiency"
}

# -------------------------
# 🔹 SAFE INPUT MAPPING (VERY IMPORTANT)
# -------------------------
def map_input(data):
    return {
        "temp": data.get("temp") or data.get("temperature_c"),
        "humidity": data.get("humidity") or data.get("humidity_pct"),
        "speed": data.get("speed") or data.get("spindle_speed"),
        "efficiency": data.get("efficiency") or data.get("efficiency_pct"),
        "stage": data.get("stage", 5),
        "hour": data.get("hour") or data.get("shift_hours", 8)
    }

# -------------------------
# 🔹 STATE DISCRETIZATION
# -------------------------
def get_state_key(state):
    return (
        round(state[0] / 2) * 2,
        round(state[1] / 5) * 5,
        round(state[2] / 1000) * 1000,
        round(state[3]),
        int(state[4]),
        round(state[5] / 2) * 2
    )

# -------------------------
# 🔹 FIND CLOSEST STATE
# -------------------------
def find_closest_state(key):
    if len(q_table) == 0:
        return key
    keys = np.array(list(q_table.keys()))
    distances = np.linalg.norm(keys - np.array(key), axis=1)
    return tuple(keys[np.argmin(distances)])

# -------------------------
# 🔹 APPLY ACTION
# -------------------------
def apply_action(state, action):
    new_state = state.copy()

    if action == 0: new_state[2] += 1000
    elif action == 1: new_state[2] -= 1000
    elif action == 2: new_state[1] += 5
    elif action == 3: new_state[1] -= 5
    elif action == 4: new_state[3] += 1
    elif action == 5: new_state[3] -= 1

    # 🔒 SAFETY LIMITS
    new_state[2] = np.clip(new_state[2], 17000, 22000)
    new_state[1] = np.clip(new_state[1], 40, 80)
    new_state[3] = np.clip(new_state[3], 90, 100)

    return new_state

# -------------------------
# 🔹 REWARD FUNCTION (IMPROVED)
# -------------------------
def calculate_reward(w_before, w_after, p_before, p_after):
    waste_gain = w_before - w_after
    prod_gain = p_after - p_before

    # Penalize if the move actually made things worse
    penalty = 0
    if w_after > w_before:
        penalty -= 2
    if p_after < p_before:
        penalty -= 1

    return (waste_gain * 2.5) + (prod_gain * 0.7) + penalty


# -------------------------
# 🔹 Q-TABLE UPDATE
# -------------------------
def update_q(q_table, key, action, reward, next_key):
    alpha = 0.15   # faster learning
    gamma = 0.9

    if key not in q_table:
        q_table[key] = np.zeros(6)

    if next_key not in q_table:
        q_table[next_key] = np.zeros(6)

    old = q_table[key][action]
    next_max = np.max(q_table[next_key])

    q_table[key][action] = old + alpha * (reward + gamma * next_max - old)

# -------------------------
# 🚀 MAIN API
# -------------------------
@router.post("/optimize")
def optimize(data: dict):
    try:
        # -------------------------
        # 🔹 INPUT MAPPING
        # -------------------------
        mapped = map_input(data)

        if None in mapped.values():
            return {"error": "Missing required input values", "received": mapped}

        state = np.array([
            mapped["temp"],
            mapped["humidity"],
            mapped["speed"],
            mapped["efficiency"],
            mapped["stage"],
            mapped["hour"]
        ], dtype=float)

        key = get_state_key(state)

        if key not in q_table:
            key = find_closest_state(key)

        # -------------------------
        # 🔹 ACTION SELECTION (SMART EPSILON)
        # -------------------------
        epsilon = max(0.05, 0.3 - (len(q_table) / 10000))  # decay exploration

        if np.random.rand() < epsilon:
            action = np.random.randint(0, 6)
        else:
            action = int(np.argmax(q_table.get(key, np.zeros(6))))

        new_state = apply_action(state, action)

        # -------------------------
        # 🔹 BEFORE
        # -------------------------
        waste_before = predict_waste(SimpleNamespace(
            temperature_c=state[0],
            humidity_pct=state[1],
            spindle_speed=state[2],
            efficiency_pct=state[3],
            stage="Spinning"
        ))["predicted_value"]

        prod_before = predict_production(SimpleNamespace(
            spindle_speed=state[2],
            efficiency_pct=state[3],
            waste_pct=waste_before,
            temperature_c=state[0],
            humidity_pct=state[1],
            shift_hours=state[5]
        ))["predicted_value"]

        # -------------------------
        # 🔹 AFTER
        # -------------------------
        waste_after = predict_waste(SimpleNamespace(
            temperature_c=new_state[0],
            humidity_pct=new_state[1],
            spindle_speed=new_state[2],
            efficiency_pct=new_state[3],
            stage="Spinning"
        ))["predicted_value"]

        prod_after = predict_production(SimpleNamespace(
            spindle_speed=new_state[2],
            efficiency_pct=new_state[3],
            waste_pct=waste_after,
            temperature_c=new_state[0],
            humidity_pct=new_state[1],
            shift_hours=new_state[5]
        ))["predicted_value"]

        # -------------------------
        # 🔥 RL UPDATE
        # -------------------------
        reward = calculate_reward(waste_before, waste_after, prod_before, prod_after)
        next_key = get_state_key(new_state)

        update_q(q_table, key, action, reward, next_key)

        joblib.dump(q_table, MODEL_PATH)

        # -------------------------
        # 🔹 RESPONSE (FRONTEND FRIENDLY)
        # -------------------------
        return {
            "action": actions_map[action],

            "before_waste": round(waste_before, 2),
            "before_production": round(prod_before, 2),

            "after_waste": round(waste_after, 2),
            "after_production": round(prod_after, 2),

            "reward": round(reward, 2),

            "suggested_temp": float(new_state[0]),
            "suggested_humidity": float(new_state[1]),
            "suggested_speed": float(new_state[2]),
            "suggested_efficiency": float(new_state[3])
        }

    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }