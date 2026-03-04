import pytest
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.market_share import MarketShareService
from app.utils.constants import MONTHS

class TestMarketShareService:
    @pytest.fixture
    def service(self):
        return MarketShareService()

    def test_relative_change_positive(self, service):
        result = service.calculate_relative_change(10)
        assert all(v == 1.10 for v in result.values())

    def test_relative_change_zero(self, service):
        result = service.calculate_relative_change(0)
        assert all(v == 1.0 for v in result.values())

    def test_macro_scenario(self, service):
        result = service.calculate_macro_scenario(market_growth=25, our_capacity=10)
        assert all(abs(v - 0.85) < 0.01 for v in result.values())