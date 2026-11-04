# Operacje

Praktyczne procedury uruchamiania stacku compose. Każdy krok z tej strony został przećwiczony na żywym stacku 2026-11-04.

## Pliki sekretów

`Infrastructure/secrets/gen-secrets.sh` tworzy wszystko, czego stack potrzebuje. Uruchom go raz przed pierwszym `docker compose up`. Sześć losowych wartości trafia do plików `*.secret`, a dwa pliki pochodne są przebudowywane przy każdym uruchomieniu, userlista PgBouncera i konfiguracja domyślnych poświadczeń RabbitMQ. Istniejące pliki `.secret` nigdy nie są nadpisywane, więc ponowne uruchomienie jest bezpieczne.

Git ignoruje cały katalog poza generatorem i szablonami `*.example`.

Stack konsumuje te pliki na trzy sposoby.

- Sekrety plikowe compose montowane pod `/run/secrets`. PostgreSQL i Redis czytają stamtąd swoje hasła, a oba kontenery vaulta czytają deweloperski root token.
- Zwykłe montowania read-only dla dwóch plików pochodnych. PgBouncer dostaje `pgbouncer-userlist.txt` jako swój `auth_file`, RabbitMQ dostaje `rabbitmq-defaults.conf` jako wpis `conf.d` (obraz twardo odrzuca zmienną `RABBITMQ_DEFAULT_PASS_FILE`, więc plik konfiguracyjny to wspierana droga).
- `vault-init` czyta te same pliki i seeduje sekrety aplikacji do OpenBao pod `secret/auction/api`.

Aby zrotować hasło infrastruktury, zmień jego plik `.secret`, uruchom ponownie `gen-secrets.sh` dla odświeżenia plików pochodnych, odtwórz dotkniętą usługę i zrestartuj api (trzyma w pamięci wartości odczytane z vaulta). Wyjątkiem jest PostgreSQL, jego katalog danych pamięta hasło z pierwszej inicjalizacji, więc zmiana wymaga `docker volume rm proj_pgdata` (dane dev przepadają) albo ręcznego `ALTER ROLE`.

## Cykl życia deweloperskiego vaulta

Usługa `vault` uruchamia OpenBao w trybie dev, w pamięci, od razu odpieczętowany, root token pochodzi z `vault-root-token.secret`. Każdy restart czyści go do zera.

`vault-init` seeduje go na nowo przy każdym `docker compose up -d`. Włącza AppRole i silnik KV v2, zapisuje politykę `auction-api` (odczyt wyłącznie `secret/data/auction/api`), tworzy AppRole, wkłada pięć sekretów aplikacji i zostawia świeże pliki `role-id` oraz `secret-id` w wolumenie `vaultcreds`.

Api czyta vault raz przy starcie, więc po każdym seedowaniu vaulta zrestartuj api przez `docker compose restart api`. Gdy vaulta nie ma, api kończy się czytelnym `Vault at 'http://vault:8200' is unreachable or timed out`, a polityka restartów ponawia próby, aż vault wróci. Po restarcie samego kontenera vaulta uruchom ponownie `docker compose up -d`, aby `vault-init` wykonał się jeszcze raz, a potem zrestartuj api.

## Ćwiczenie unseal (tryb trwały)

`compose.vault-persistent.yaml` przełącza vault na magazyn raft (wolumen `vaultdata`) z ręcznym odpieczętowaniem, czyli zachowanie prawdziwych wdrożeń. Ćwiczenie, zweryfikowane od początku do końca:

1. `docker compose -f compose.yaml -f compose.vault-persistent.yaml up -d vault`
2. Tylko za pierwszym razem, zainicjalizuj i zachowaj wynik w bezpiecznym miejscu:
   `docker compose exec -e BAO_ADDR=http://127.0.0.1:8200 vault bao operator init -key-shares=1 -key-threshold=1`
3. Odpieczętuj:
   `docker compose exec -e BAO_ADDR=http://127.0.0.1:8200 vault bao operator unseal <klucz unseal>`
4. Przepisz wartość `Initial Root Token` do `Infrastructure/secrets/vault-root-token.secret`, aby `vault-init` mógł się zalogować.
5. `docker compose -f compose.yaml -f compose.vault-persistent.yaml up -d`, potem `docker compose restart api`.
6. Zrestartuj vault i uruchom `bao status`. `Initialized true` razem z `Sealed true` oznacza, że dane przetrwały, a pieczęć wróciła. Powtórz krok 3 i stack sam dochodzi do siebie.

Powrót do trybu dev to trzy kroki. Przegeneruj plik root tokena przez `rm Infrastructure/secrets/vault-root-token.secret && ./Infrastructure/secrets/gen-secrets.sh`, bo tryb dev odmawia root tokena w formacie tokenów serwisowych `s.` (złapane na żywo podczas ćwiczenia). Następnie `docker compose up -d --force-recreate vault vault-init` oraz `docker compose restart api`. Na końcu `docker volume rm proj_vaultdata` usuwa dane rafta.

## Backupy bazy danych

Serwis `pgbackup` (`prodrigestivill/postgres-backup-local:16-alpine`) uruchamia `pg_dump` prosto na PostgreSQL, z pominięciem PgBouncera, bo pooling transakcyjny psuje pojedynczą długą sesję, której potrzebuje zrzut. Harmonogram to `@daily` (północ), a każdy przebieg rotuje trzy koszyki w wolumenie `pgbackups`. `daily/` trzyma 7 kopii, `weekly/` 4, a `monthly/` 6, każdy koszyk czyszczony niezależnie, przy czym najnowszy zrzut jest zawsze podlinkowany jako `last/auctionserver-latest.sql.gz`.

Backup na żądanie, na przykład przed ryzykowną migracją:

```
docker compose exec pgbackup /backup.sh
```

## Ćwiczenie restore

Zweryfikowane od początku do końca 2026-11-04 (4 użytkowników i 40 tabel zgodnych między źródłem a odtworzoną kopią).

1. Utwórz bazę tymczasową:
   `docker compose exec postgres psql -U auction -d postgres -c 'CREATE DATABASE auctionserver_drill'`
2. Odtwórz do niej najnowszy zrzut:
   `docker compose exec pgbackup sh -c 'export PGPASSWORD=$(cat /run/secrets/postgres_password); zcat /backups/last/auctionserver-latest.sql.gz | psql -h postgres -U auction -d auctionserver_drill -q -v ON_ERROR_STOP=1'`
3. Porównaj kilka liczników ze źródłem, na przykład `SELECT count(*) FROM "Users"` i sumę z `information_schema.tables`.
4. Skasuj bazę tymczasową:
   `docker compose exec postgres psql -U auction -d postgres -c 'DROP DATABASE auctionserver_drill'`

Aby zamiast tego podmienić prawdziwą bazę, najpierw zatrzymaj api (`docker compose stop api`), skasuj i utwórz `auctionserver` tak samo, odtwórz do niej zrzut i wystartuj api ponownie. Zrzut zawiera czysty SQL, więc restore potrzebuje pustej bazy, nie bazy po migracjach.

## Rozwiązywanie problemów

| Objaw | Znaczenie | Naprawa |
|---|---|---|
| api loguje `Vault at ... unreachable or timed out` | vault leży albo wciąż zapieczętowany | uruchom lub odpieczętuj vault, api ponawia samo |
| api loguje `denied reading ... policy does not cover it` | polityka i ścieżka się rozjechały | porównaj politykę w `vault-init.sh` z `Vault__SecretPath` |
| api loguje `has no secret at ...` | vault działa, ale nie zseedowany | `docker compose up -d`, aby `vault-init` wykonał się ponownie |
| `vault-init` kończy się kodem 2 i 403 na `sys/internal/ui/mounts` | brak silnika KV na świeżym trwałym vaulcie | obsłużone w skrypcie (`bao secrets enable`), uruchom ponownie |
| UI RabbitMQ odrzuca logowanie | hasło jest teraz generowane | użytkownik `auction`, hasło w `rabbitmq-password.secret` |
