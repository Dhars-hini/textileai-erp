import numpy as np
import random


class QAgent:
    """Q-Learning agent for textile mill optimisation.

    Actions (6 total — must match optimize.py actions_map):
        0: Increase Speed
        1: Decrease Speed
        2: Increase Humidity
        3: Decrease Humidity
        4: Increase Efficiency
        5: Decrease Efficiency
    """

    def __init__(self):
        self.q_table = {}
        self.actions = [0, 1, 2, 3, 4, 5]   # 6 actions

    def get_state_key(self, state):
        return tuple(state.round(0))

    def choose_action(self, state, epsilon=0.2):
        """Choose action with epsilon-greedy policy.

        Args:
            state:   numpy array of environment state
            epsilon: exploration probability (default 0.2)
        """
        key = self.get_state_key(state)
        if key not in self.q_table:
            self.q_table[key] = np.zeros(len(self.actions))

        if random.random() < epsilon:
            return random.choice(self.actions)

        return int(np.argmax(self.q_table[key]))

    def update(self, state, action, reward, next_state):
        key      = self.get_state_key(state)
        next_key = self.get_state_key(next_state)

        if next_key not in self.q_table:
            self.q_table[next_key] = np.zeros(len(self.actions))

        lr    = 0.1
        gamma = 0.9

        self.q_table[key][action] += lr * (
            reward + gamma * np.max(self.q_table[next_key]) - self.q_table[key][action]
        )
