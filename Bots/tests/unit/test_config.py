from pathlib import Path

from auction_bots.config import load_settings


def test_defaults_load_from_bots_toml(settings_path: Path) -> None:
    settings = load_settings(settings_path, env={})

    assert settings.fleet.size == 100
    assert settings.budget.rate_per_s == 45
    assert settings.budget.burst == 60
    assert settings.budget.login_interval_s == 1.2
    assert settings.director.window == 50
    assert settings.director.target_margin == 0.15
    assert settings.listing.active_listings_max == 30
    assert settings.listing.listing_rate_max == 10


def test_env_overrides_win(settings_path: Path) -> None:
    env = {"BOTS_FLEET_SIZE": "10", "BOTS_GATEWAY_URL": "http://localhost:8080"}

    settings = load_settings(settings_path, env=env)

    assert settings.fleet.size == 10
    assert settings.gateway.url == "http://localhost:8080"


def test_archetype_shares_sum_to_one(settings_path: Path) -> None:
    settings = load_settings(settings_path, env={})

    total = sum(archetype.share for archetype in settings.archetypes.values())

    assert abs(total - 1.0) < 1e-9
