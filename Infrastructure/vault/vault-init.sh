#!/bin/sh
set -eu
export BAO_ADDR=http://vault:8200
BAO_TOKEN="$(cat /run/secrets/vault_root_token)"
export BAO_TOKEN

bao auth enable approle 2>/dev/null || true

bao policy write auction-api - <<'EOF'
  path "secret/data/auction/api" {
    capabilities = ["read"]
  }
EOF

bao write auth/approle/role/auction-api token_policies=auction-api

bao kv put -mount=secret auction/api \
  "ConnectionStrings:DefaultConnection=Host=pgbouncer;Port=6432;Database=auctionserver;Username=auction;Password=$(cat /run/secrets/postgres_password);No Reset On Close=true" \
  "Jwt:Key=$(cat /run/secrets/jwt_key)" \
  "Bots:ApiKey=$(cat /run/secrets/bots_api_key)" \
  "Messaging:Rabbit:Password=$(cat /run/secrets/rabbitmq_password)" \
  "Cache:Redis:ConnectionString=redis:6379,password=$(cat /run/secrets/redis_password)"

bao read -field=role_id auth/approle/role/auction-api/role-id > /vault/credentials/role-id
bao write -f -field=secret_id auth/approle/role/auction-api/secret-id > /vault/credentials/secret-id

echo "vault-init complete"
