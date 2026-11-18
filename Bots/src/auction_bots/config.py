import tomllib
from collections.abc import Mapping
from datetime import date
from pathlib import Path

from pydantic import BaseModel


class FleetSettings(BaseModel):
    size: int
    seed: int
    startup_ramp_s: float


class GatewaySettings(BaseModel):
    url: str


class BudgetSettings(BaseModel):
    rate_per_s: float
    burst: int
    login_interval_s: float
    saga_rate_per_s: float
    saga_burst: int


class AmqpSettings(BaseModel):
    host: str
    port: int
    user: str
    vhost: str
    exchange: str
    queue_prefix: str
    message_ttl_ms: int
    queue_expires_ms: int
    prefetch: int


class SecretsSettings(BaseModel):
    api_key_file: Path
    amqp_password_file: Path


class MarketSettings(BaseModel):
    resync_interval_s: float
    prune_after_s: float


class MoneySettings(BaseModel):
    topup_fraction: float
    topup_interval_s: float
    wallet_wait_s: float


class ListingSettings(BaseModel):
    start_price_min: float
    start_price_max: float
    duration_min_m: float
    duration_max_m: float
    max_items: int
    relist_discount: float
    active_listings_min: int
    active_listings_max: int
    listing_rate_start: float
    listing_rate_min: float
    listing_rate_max: float
    rarity_mix: dict[str, float]


class WarehouseSettings(BaseModel):
    list_poll_s: float
    detail_poll_s: float
    fill_within_s: float
    third_bot_p: float
    bot_war_target_min: float
    bot_war_target_max: float


class DirectorSettings(BaseModel):
    interval_s: float
    window: int
    min_outcomes: int
    target_margin: float
    gain: float
    dead_zone: float
    generosity_start: float
    saga_slow_p50_s: float
    saga_fast_p50_s: float


class PersonaSettings(BaseModel):
    reaction_delay_min_s: float
    reaction_delay_max_s: float
    tick_min_s: float
    tick_max_s: float
    activity_min: float
    activity_max: float
    yield_bias_min: float
    yield_bias_max: float
    max_open_bids_min: int
    max_open_bids_max: int
    max_listings_min: int
    max_listings_max: int
    birthday: date


class ArchetypeSettings(BaseModel):
    share: float
    multiplier_min: float
    multiplier_max: float
    bankroll_min: int
    bankroll_max: int
    step_min: float
    step_max: float
    activity: float | None = None
    single_bid: bool = False
    list_batch_min: int = 1
    list_batch_max: int = 1


class Settings(BaseModel):
    fleet: FleetSettings
    gateway: GatewaySettings
    budget: BudgetSettings
    amqp: AmqpSettings
    secrets: SecretsSettings
    market: MarketSettings
    money: MoneySettings
    listing: ListingSettings
    warehouses: WarehouseSettings
    director: DirectorSettings
    persona: PersonaSettings
    archetypes: dict[str, ArchetypeSettings]


ENV_OVERRIDES: Mapping[str, tuple[str, str]] = {
    "BOTS_FLEET_SIZE": ("fleet", "size"),
    "BOTS_GATEWAY_URL": ("gateway", "url"),
    "BOTS_AMQP_HOST": ("amqp", "host"),
    "BOTS_API_KEY_FILE": ("secrets", "api_key_file"),
    "BOTS_AMQP_PASSWORD_FILE": ("secrets", "amqp_password_file"),
    "BOTS_SEED": ("fleet", "seed"),
}


def load_settings(path: Path, env: Mapping[str, str]) -> Settings:
    with path.open("rb") as handle:
        raw = tomllib.load(handle)
    for name, (table, key) in ENV_OVERRIDES.items():
        if name in env:
            raw.setdefault(table, {})[key] = env[name]
    return Settings.model_validate(raw)
