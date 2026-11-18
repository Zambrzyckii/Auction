import base64
import json
import random
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from auction_bots.api.client import EmailTaken, UsernameTaken
from auction_bots.api.models import LoginResponse
from auction_bots.config import Settings, load_settings
from auction_bots.fleet.identity import (
    derive_identity,
    fingerprint,
    provision_or_login,
    read_jwt_claims,
)
from auction_bots.fleet.persona import sample_persona

API_KEY = "test-api-key-not-a-real-secret"
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$")
NOW = datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def settings(settings_path: Path) -> Settings:
    return load_settings(settings_path, env={})


def persona_of(index: int, settings: Settings):
    return sample_persona(index, random.Random(settings.fleet.seed + index), settings)


def unsigned_jwt(user_id: UUID, exp: datetime) -> str:
    def b64(payload: dict) -> str:
        raw = json.dumps(payload).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    header = b64({"alg": "HS256", "typ": "JWT"})
    body = b64({"nameid": str(user_id), "exp": int(exp.timestamp()), "role": "Bot"})
    return f"{header}.{body}.signature"


def test_password_satisfies_the_backend_validator(settings: Settings) -> None:
    for index in range(100):
        identity = derive_identity(index, API_KEY, persona_of(index, settings))
        assert PASSWORD_REGEX.match(identity.password)
        assert len(identity.password) == 24


def test_email_carries_the_key_fingerprint(settings: Settings) -> None:
    fp = fingerprint(API_KEY)
    identity = derive_identity(7, API_KEY, persona_of(7, settings))

    assert len(fp) == 6
    assert identity.email == f"bot-007-{fp}@bots.auction.local"


def test_username_fits_thirty_characters_and_follows_the_key(settings: Settings) -> None:
    for index in (0, 7, 99):
        persona = persona_of(index, settings)
        identity = derive_identity(index, API_KEY, persona)
        other_key = derive_identity(index, "another-api-key", persona)

        assert len(identity.username) <= 30
        assert identity.username == f"{persona.first_name}{index:03d}{fingerprint(API_KEY)[:3]}"
        assert identity.username != other_key.username


def test_secrets_are_absent_from_repr(settings: Settings) -> None:
    identity = derive_identity(1, API_KEY, persona_of(1, settings))

    assert identity.password not in repr(identity)


class FakeIdentityApi:
    def __init__(self, provision_error: Exception | None, token: str) -> None:
        self.provision_error = provision_error
        self.token = token
        self.logins: list[str] = []

    async def provision_bot(self, api_key: str, body: dict) -> UUID:
        if self.provision_error is not None:
            raise self.provision_error
        return uuid4()

    async def login(self, email: str, password: str) -> LoginResponse:
        self.logins.append(email)
        return LoginResponse(token=self.token, refresh_token=None)


async def test_email_conflict_falls_back_to_login(settings: Settings) -> None:
    user_id = uuid4()
    exp = NOW + timedelta(hours=24)
    api = FakeIdentityApi(EmailTaken(409, "This email is taken"), unsigned_jwt(user_id, exp))
    identity = derive_identity(2, API_KEY, persona_of(2, settings))

    session = await provision_or_login(api, API_KEY, identity, random.Random(1), NOW)

    assert session is not None
    assert session.user_id == user_id
    assert api.logins == [identity.email]


async def test_username_conflict_skips_the_bot(settings: Settings) -> None:
    api = FakeIdentityApi(UsernameTaken(409, "This username is taken"), "unused")
    identity = derive_identity(3, API_KEY, persona_of(3, settings))

    session = await provision_or_login(api, API_KEY, identity, random.Random(1), NOW)

    assert session is None


async def test_relogin_is_one_hour_before_expiry_with_jitter(settings: Settings) -> None:
    exp = NOW + timedelta(hours=24)
    api = FakeIdentityApi(None, unsigned_jwt(uuid4(), exp))
    identity = derive_identity(4, API_KEY, persona_of(4, settings))

    for seed in range(20):
        session = await provision_or_login(api, API_KEY, identity, random.Random(seed), NOW)
        assert session is not None
        assert exp - timedelta(minutes=90) <= session.relogin_at <= exp - timedelta(minutes=60)
        assert session.expires_at == exp
        assert session.token not in repr(session)


def test_jwt_claims_are_read_without_verification() -> None:
    user_id = uuid4()
    exp = NOW + timedelta(hours=24)

    claims_id, claims_exp = read_jwt_claims(unsigned_jwt(user_id, exp))

    assert claims_id == user_id
    assert claims_exp == exp
