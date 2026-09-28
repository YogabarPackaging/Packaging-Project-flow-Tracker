# Same-Day Go-Live

## Recommended server

Use one Ubuntu 24.04 VPS with 2 vCPU, 2 GB RAM, and at least 40 GB SSD. Keep PostgreSQL on the managed database service and artwork in DigitalOcean Spaces. This is the lowest-cost low-maintenance setup for approximately 10 internal users.

## Before connecting

You need:

- A domain name, for example `packaging.yogabars.in`
- The VPS public IPv4 address
- An SSH key for the VPS
- Access to edit the domain DNS records
- A private DigitalOcean Spaces bucket and access key with bucket-scoped permissions

Create one DNS record:

```text
Type: A
Name: packaging
Value: <VPS_PUBLIC_IP>
TTL: Auto
```

Create a private Spaces bucket in the same region as the Droplet, preferably `blr1`. Create an access key restricted to that bucket with object read/write/delete permissions. Do not make the bucket public; the application serves files through its authenticated API.

Do not publish the app until DNS resolves to the VPS.

## Install Docker on Ubuntu
## Install Docker on Ubuntu

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Allow only SSH, HTTP, and HTTPS:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <YOUR_ADMIN_PUBLIC_IP>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## Deploy

```bash
sudo mkdir -p /opt/packaging-tracker
sudo chown -R "$USER":"$USER" /opt/packaging-tracker
git clone https://github.com/YogabarPackaging/Packaging-Project-flow-Tracker.git /opt/packaging-tracker
cd /opt/packaging-tracker
cp .env.example .env
```

Edit `.env` and set the real domain plus a unique database password:

```bash
nano .env
```

Set these values in the file:

```env
APP_DOMAIN=packaging.yogabars.in
POSTGRES_DB=packaging
POSTGRES_USER=packaging_app
POSTGRES_PASSWORD=<LONG_RANDOM_DATABASE_PASSWORD>
SPACES_ENDPOINT=https://blr1.digitaloceanspaces.com
SPACES_REGION=blr1
SPACES_BUCKET=packaging-artwork
SPACES_KEY=<SPACES_ACCESS_KEY>
SPACES_SECRET=<SPACES_SECRET>
```

Start the database and application:

```bash
docker compose up -d --build
docker compose ps
docker compose exec app npm run db:setup --prefix server
curl -fsS https://packaging.yogabars.in/api/health
```

The health response must report `"status":"healthy"` and `"database":"connected"`.

After first login, upload a small artwork, refresh the project, restart the app, and open the artwork again. This verifies that the file is in Spaces rather than the container filesystem.

Caddy obtains and renews the HTTPS certificate automatically. If it cannot issue a certificate, check DNS and ensure ports 80 and 443 are reachable from the internet.

## First login and security

Immediately after the first login:

1. Change every seeded/default user password.
2. Create only the 10 required users.
3. Remove or disable unused accounts.
4. Confirm an updater cannot perform admin or superadmin actions.
5. Upload one approved artwork and verify it remains after restarting the app.
6. Confirm a blocked executable upload is rejected.

## Backups

Enable DigitalOcean Managed Database backups and Spaces versioning before production use. Keep an external copy of important artwork and test a database restore before relying on the setup. The app server itself is disposable because the database and artwork are managed outside the Droplet.

## Updates and rollback

```bash
cd /opt/packaging-tracker
git pull origin main
docker compose up -d --build
curl -fsS https://packaging.yogabars.in/api/health
```

If the new release fails, return to the previous commit and rebuild:

```bash
git log --oneline -5
git checkout <previous-known-good-commit>
docker compose up -d --build
```
