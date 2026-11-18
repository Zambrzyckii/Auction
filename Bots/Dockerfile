FROM python:3.15-slim

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

COPY bots.toml ./

RUN useradd --uid 1001 --create-home bots
USER bots

ENTRYPOINT ["python", "-m", "auction_bots"]
