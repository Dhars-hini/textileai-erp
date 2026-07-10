import numpy as np
import random
import joblib
import os
import sys
from types import SimpleNamespace

# Get project root (backend folder)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, BASE_DIR)

print("BASE_DIR:", BASE_DIR)
from app.ml_model import predict_waste_ml as predict_waste, predict_production_ml as predict_production

print("🚀 RL training started...")

# Ensure folder exists
MODEL_PATH = "app/models_trained/rl_q_table.pkl"
os.makedirs("app/models_trained", exist_ok=True)


# -----------------------------
# Q-Learning Agent
# -----------------------------
class QAgent:
    def __init__(self):
        self.q_table = {}
        self.actions = [0, 1, 2, 3, 4, 5]  # 6 actions

    def get_state_key(self, state):
        return tuple(np.round(state, 0))

    def choose_action(self, state, epsilon=0.1):
        """Choose action with given epsilon for exploration.
        epsilon is passed in so this method has no dependency on outer scope variables."""
        key = self.get_state_key(state)

        if key not in self.q_table:
            self.q_table[key] = np.zeros(len(self.actions))

        if random.random() < epsilon:
            return random.choice(self.actions)

        return int(np.argmax(self.q_table[key]))

    def update(self, state, action, reward, next_state):
        key = self.get_state_key(state)
        next_key = self.get_state_key(next_state)

        if next_key not in self.q_table:
            self.q_table[next_key] = np.zeros(len(self.actions))

        lr = 0.1
        gamma = 0.9

        self.q_table[key][action] += lr * (
            reward + gamma * np.max(self.q_table[next_key]) - self.q_table[key][action]
        )


# -----------------------------
# Reward function
# -----------------------------
def get_reward(state):
    temp, hum, speed, eff, stage, hour = state

    try:
        # Use SimpleNamespace so ml_model attribute access works correctly
        waste_result = predict_waste(SimpleNamespace(
            temperature_c=float(temp),
            humidity_pct=float(hum),
            spindle_speed=float(speed),
            efficiency_pct=float(eff),
            stage="Spinning",
        ))
        prod_result = predict_production(SimpleNamespace(
            spindle_speed=float(speed),
            efficiency_pct=float(eff),
            waste_pct=waste_result["predicted_value"],
            temperature_c=float(temp),
            humidity_pct=float(hum),
            shift_hours=float(hour),
        ))
        waste      = waste_result["predicted_value"]
        production = prod_result["predicted_value"]
    except Exception:
        return -100  # avoid crash

    reward = production - (waste * 50)
    return reward


def apply_action(state, action):
    new_state = state.copy()

    if action == 0:   new_state[2] += 1000   # speed++
    elif action == 1: new_state[2] -= 1000   # speed--
    elif action == 2: new_state[1] += 5      # humidity++
    elif action == 3: new_state[1] -= 5      # humidity--
    elif action == 4: new_state[3] += 1      # efficiency++
    elif action == 5: new_state[3] -= 1      # efficiency--

    new_state[2] = np.clip(new_state[2], 17000, 22000)
    new_state[1] = np.clip(new_state[1], 40, 80)
    new_state[3] = np.clip(new_state[3], 90, 100)

    return new_state


# -----------------------------
# Training Loop
# -----------------------------
agent = QAgent()
NUM_EPISODES = 1000

for episode in range(NUM_EPISODES):
    state = np.array([30, 60, 19000, 95, 5, 12], dtype=float)

    # Epsilon decays from ~1.0 to 0.1 over training
    epsilon = max(0.1, 1 - episode / 300)

    for step in range(100):
        action     = agent.choose_action(state, epsilon=epsilon)
        next_state = apply_action(state, action)
        reward     = get_reward(next_state)

        agent.update(state, action, reward, next_state)
        state = next_state

print("💾 Saving Q-table...")
joblib.dump(agent.q_table, MODEL_PATH)

print("✅ RL training finished")
print(f"Saved at: {MODEL_PATH}")
