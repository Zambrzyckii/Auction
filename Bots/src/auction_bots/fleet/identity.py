import base64
import hashlib
import hmac
import json
import logging
import random
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from auction_bots.api.client import EmailTaken, MarketApi, UsernameTaken
from auction_bots.fleet.persona import Persona

log = logging.getLogger("fleet")

DEFAULT_BIRTHDAY = date(1975, 1, 1)


@dataclass(frozen=True)
class BotIdentity:
    index: int
    email: str
    username: str
    name: str
    surname: str
    birthday: date
    password: str = field(repr=False)


@dataclass
class BotSession:
    index: int
    user_id: UUID
    expires_at: datetime
    relogin_at: datetime
    token: str = field(repr=False)


def fingerprint(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()[:6]


def derive_identity(
    index: int, api_key: str, persona: Persona, *, birthday: date = DEFAULT_BIRTHDAY
) -> BotIdentity:
    fp = fingerprint(api_key)
    digest = hmac.new(api_key.encode(), f"bot-{index}-{fp}".encode(), hashlib.sha256).digest()
    password = base64.urlsafe_b64encode(digest).decode()[:20] + "Aa1!"
    return BotIdentity(
        index=index,
        email=f"bot-{index:03d}-{fp}@bots.auction.local",
        username=f"{persona.first_name}{index:03d}{fp[:3]}",
        name=persona.first_name,
        surname=persona.surname,
        birthday=birthday,
        password=password,
    )


def read_jwt_claims(token: str) -> tuple[UUID, datetime]:
    payload_part = token.split(".")[1]
    padded = payload_part + "=" * (-len(payload_part) % 4)
    claims = json.loads(base64.urlsafe_b64decode(padded))
    return UUID(claims["nameid"]), datetime.fromtimestamp(int(claims["exp"]), tz=UTC)


async def provision_or_login(
    api: MarketApi,
    api_key: str,
    identity: BotIdentity,
    rng: random.Random,
    now: datetime,
) -> BotSession | None:
    body = {
        "email": identity.email,
        "password": identity.password,
        "username": identity.username,
        "name": identity.name,
        "surname": identity.surname,
        "birthday": identity.birthday.isoformat(),
    }
    try:
        await api.provision_bot(api_key, body)
    except EmailTaken:
        log.info("bot %03d already provisioned, logging in", identity.index)
    except UsernameTaken:
        log.warning("bot %03d skipped, its username is taken by someone else", identity.index)
        return None
    response = await api.login(identity.email, identity.password)
    user_id, expires_at = read_jwt_claims(response.token)
    relogin_at = expires_at - timedelta(minutes=60) - timedelta(minutes=rng.uniform(0.0, 30.0))
    return BotSession(
        index=identity.index,
        user_id=user_id,
        expires_at=expires_at,
        relogin_at=relogin_at,
        token=response.token,
    )
