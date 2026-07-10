import numpy as np
from types import SimpleNamespace
from app.ml_model import predict_waste_ml, predict_production_ml

class TextileEnv:
    def __init__(self):
        self.state = None

    def reset(self):
        self.state = np.array([30, 60, 19000, 95, 5, 12], dtype=float)
        return self.state

    def step(self, action):
        temp, hum, speed, eff, stage, hour = self.state

        # Apply actions
        if action == 0: speed += 500
        elif action == 1: speed -= 500
        elif action == 2: hum += 2
        elif action == 3: hum -= 2

        # Clamp values
        speed = np.clip(speed, 17000, 22000)
        hum   = np.clip(hum, 40, 80)

        new_state = np.array([temp, hum, speed, eff, stage, hour])

        waste_result = predict_waste_ml(SimpleNamespace(
            temperature_c=new_state[0],
            humidity_pct=new_state[1],
            spindle_speed=new_state[2],
            efficiency_pct=new_state[3],
            stage="Spinning"
        ))
        prod_result = predict_production_ml(SimpleNamespace(
            spindle_speed=new_state[2],
            efficiency_pct=new_state[3],
            waste_pct=waste_result["predicted_value"],
            temperature_c=new_state[0],
            humidity_pct=new_state[1],
            shift_hours=new_state[5]
        ))

        waste      = waste_result["predicted_value"]
        production = prod_result["predicted_value"]

        # Adjusted reward scaling
        reward = (production / 1000) - (waste * 5)

        # Add terminal condition
        done = reward < -10 or hour >= 24

        self.state = new_state
        return new_state, reward, done, {}