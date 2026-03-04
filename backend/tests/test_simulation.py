import pytest
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.simulation import SimulationEngine
from app.utils.constants import MONTHS

class TestSimulationEngine:
    @pytest.fixture
    def engine(self):
        return SimulationEngine()

    @pytest.fixture
    def sample_baseline(self):
        return [1000, 1100, 1200, 1150, 1300, 1400, 1350, 1250, 1200, 1100, 1050, 1000]

    @pytest.fixture
    def sample_weights(self):
        return {
            'UpromoUp': [1.15] * 12,
            'UPromoDwn': [0.92] * 12,
            'Shortage': [0.85] * 12,
            'Trend': [1.02] * 12,
        }

    def test_get_base_mult_list(self, engine):
        weights = {'test': [1.1, 1.2, 1.3] + [1.0] * 9}
        assert engine.get_base_mult(weights, 'test', 1) == 1.1
        assert engine.get_base_mult(weights, 'test', 2) == 1.2

    def test_apply_slider_mult(self, engine):
        assert engine.apply_slider_mult(1.0, 10) == 1.1
        assert engine.apply_slider_mult(1.0, -10) == 0.9