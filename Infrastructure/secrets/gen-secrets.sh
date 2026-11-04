#!/bin/sh
set -eu
cd "$(dirname "$0")"

generate() {
  [ -f "$1" ] || openssl rand -hex "$2" > "$1"
}

generate postgres-password.secret 16
generate rabbitmq-password.secret 16
generate redis-password.secret 16
generate jwt-key.secret 24
generate bots-api-key.secret 16
generate vault-root-token.secret 16

printf '"auction" "%s"\n' "$(cat postgres-password.secret)" > pgbouncer-userlist.txt

echo "secret files ready in $(pwd)"
