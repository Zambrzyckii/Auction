# Wdrożenie

> Wersja polska. Angielski odpowiednik 1:1: [../en/deployment.md](../en/deployment.md)

Każdy push do `main`, który przejdzie CI, trafia na host produkcyjny bez ręcznego kroku. CI buduje jeden obraz na commit, host pobiera dokładnie ten obraz i uruchamia stos z nakładką produkcyjną, która trzyma każdy port na interfejsie loopback. Stos nie jest jeszcze wystawiony do internetu, bo gateway nie ma TLS ([infrastructure.md](infrastructure.md#czego-brakuje)).

## Status

Ciągłe wdrażanie działa od 2026-11-21. Host produkcyjny uruchamia stos jako projekt Compose `auctions` z wyłączonymi usługami telemetrii i nie ma jeszcze publicznego punktu wejścia.

## Pipeline

1. Każdy job z [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) uruchamia się przy pushu do `main`.
2. `image` publikuje `ghcr.io/zambrzyckii/auction` z tagami `latest` i sha commita.
3. `deploy` czeka na każdy job testowy i na `image`, a potem działa w środowisku GitHub `production`, które przyjmuje wdrożenia tylko z `main`. Naraz działa jedno wdrożenie (grupa concurrency `deploy-production`), a job poddaje się po 15 minutach.
4. Job ładuje klucz wdrożeniowy do `ssh-agent`, więc klucz nigdy nie trafia na dysk runnera, zapisuje klucze hosta z sekretu do `known_hosts` i wysyła `auctions <sha>` przez SSH.
5. Host przełącza się na commit, pobiera obraz z tym samym sha i uruchamia stos. Jeśli cokolwiek zawiedzie, uruchamia ponownie poprzedni commit.

## Komenda wdrożenia

Klucz CI nie może otworzyć powłoki. Jego linia w `authorized_keys` na hoście to `command="/usr/local/bin/deploy",restrict`, więc wszystko, co wyśle klient, trafia do [`Infrastructure/deploy/deploy`](../../Infrastructure/deploy/deploy) w `SSH_ORIGINAL_COMMAND`, a `restrict` wyłącza terminale i każdy rodzaj przekierowań. Skrypt jest zainstalowany jako własność roota, więc użytkownik `deploy` może go uruchomić, ale nie może go zmienić.

Komenda ma postać `<app> <sha>`. Nazwa aplikacji może zawierać tylko małe litery, cyfry i myślniki i wymaga klonu w `/srv/<app>/repo`, a sha musi być pełnym 40-znakowym hashem commita. Wszystko inne jest odrzucane, zanim skrypt dotknie hosta, co wyklucza też ścieżki takie jak `../etc`.

| Krok | Co się dzieje |
|---|---|
| blokada | `flock` na `/srv/<app>/.lock`, więc dwa wdrożenia jednej aplikacji nigdy się nie nakładają |
| checkout | `git fetch --prune origin` i `git checkout --detach <sha>` w `/srv/<app>/repo` |
| start | `docker compose -p <app> -f compose.yaml -f compose.production.yaml` z `IMAGE_TAG=<sha>`, najpierw `pull`, potem `up -d --wait --wait-timeout 300 --remove-orphans` |
| rollback | przy każdej awarii checkout poprzedniego commita i to samo `up` z jego sha |

Oba pliki Compose pochodzą z katalogu głównego repozytorium albo z `deploy/`, gdy w katalogu głównym nie ma `compose.yaml`. Skrypt sprawdza to po każdym checkoucie, więc rollback używa układu commita, do którego wraca.

| Kod wyjścia | Znaczenie |
|---|---|
| 0 | wdrożone |
| 1 | wdrożenie się nie udało, a poprzedni commit uruchomiono ponownie |
| 2 | komenda została odrzucona |
| 3 | trwa inne wdrożenie tej samej aplikacji |

Gdy rollback też się nie uda, skrypt zatrzymuje się na tej komendzie i kończy z jej kodem, a log joba pokazuje, który to był krok.

## Nakładka produkcyjna

[`compose.production.yaml`](../../compose.production.yaml) dopasowuje [`compose.yaml`](../../compose.yaml) do hosta i jest walidowany w jobie `compose-config` z `IMAGE_TAG=ci`.

- `api` uruchamia obraz z GHCR z tagiem `IMAGE_TAG` zamiast budować `Backend/` i nie eksportuje telemetrii (`Observability__Enabled` ma wartość `false`).
- `postgres` nie publikuje portu, a `gateway` publikuje tylko `127.0.0.1:8080`. Docker zapisuje własne reguły zapory, więc port opublikowany na wszystkich interfejsach byłby publiczny nawet przy zamkniętej zaporze hosta.
- `otel-collector`, `prometheus`, `tempo` i `grafana` przechodzą za profil `observability` i startują tylko z `--profile observability`.
- `pgbackup` sprawdza swoje zdrowie co 15 s zamiast co 5 minut z obrazu, więc `up --wait` nie utyka na pierwszej próbie.

## Sekrety

| Sekret | Cel |
|---|---|
| `DEPLOY_HOST` | adres hosta produkcyjnego |
| `DEPLOY_SSH_KEY` | prywatna połowa klucza wdrożeniowego, jedyna kopia |
| `DEPLOY_KNOWN_HOSTS` | klucze hosta produkcyjnego, więc job odrzuca każdą inną maszynę |

Te trzy sekrety są w środowisku GitHub `production`, a nie w repozytorium, więc job z innej gałęzi nigdy ich nie dostaje. Sekrety aplikacji nigdy nie opuszczają hosta. [`Infrastructure/secrets/gen-secrets.sh`](../../Infrastructure/secrets/gen-secrets.sh) generuje je tam jeden raz, a ponieważ pliki są w gitignore, checkout nigdy ich nie dotyka. Host pobiera obrazy z GHCR własnym tokenem tylko do odczytu.

## Przygotowanie hosta

1. Ubuntu z Docker Engine i wtyczką Compose, SSH tylko na klucz i zapora, która wpuszcza tylko SSH.
2. Użytkownik `deploy` bez sudo i z zablokowanym hasłem, w grupie `docker`, którego jedyny klucz ma wymuszoną komendę.
3. Skrypt zainstalowany jako własność roota przez `sudo install -m 0755 -o root -g root Infrastructure/deploy/deploy /usr/local/bin/deploy`.
4. `/srv/auctions` należący do `deploy`, repozytorium sklonowane do `/srv/auctions/repo` jako `deploy`, jednorazowe `gen-secrets.sh` i `docker login ghcr.io` z tokenem `read:packages`.
5. Środowisko `production` w repozytorium GitHub, ograniczone do `main`, z trzema sekretami.

## Znane ograniczenia

- Nie ma TLS ani publicznego punktu wejścia. Do gatewaya dochodzi się tunelem SSH, np. `ssh -L 8080:127.0.0.1:8080 <host>`.
- Po restarcie hosta vault w trybie dev wraca pusty, a api restartuje się w pętli, dopóki `vault-init` nie uruchomi się ponownie (issue #24, [STATE.md](STATE.md#znane-luki)).
- Rollback uruchamia poprzedni commit z obrazem otagowanym jego sha, więc zakłada, że każdy wdrożony commit pochodzi z `main`, gdzie CI publikuje ten obraz.
- Członkostwo w grupie `docker` jest równoważne rootowi, więc granicą bezpieczeństwa klucza wdrożeniowego jest wymuszona komenda, a nie grupa.

## Powiązane dokumenty

- [infrastructure.md](infrastructure.md) - usługi, które dopasowuje nakładka.
- [operations.md](operations.md) - pliki sekretów i cykl życia vaulta.
- [ARCHITECTURE.md](ARCHITECTURE.md#build-i-ci) - pipeline CI, który kończy się na `deploy`.
