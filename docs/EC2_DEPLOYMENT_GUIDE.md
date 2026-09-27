# AWS EC2 Production Deployment Guide (Nginx + PM2 + Node.js)

This step-by-step guide walks you through deploying the **Packaging Development Tracker** onto an **AWS EC2** instance (Ubuntu 22.04 or 24.04 LTS) using **PM2** for process management, **Nginx** as a reverse proxy, and **PostgreSQL (AWS RDS or local)** for data persistence.

---

## Architecture Overview

```
Internet (Browser Clients)
         │
         ▼ Port 80 / 443 (HTTP/HTTPS)
    ┌──────────┐
    │  Nginx   │ ──► Serves Static Vite SPA (/var/www/pkg-tracker/client/dist)
    └──────────┘
         │
         │ Reverse Proxy /api/* (Port 5001)
         ▼
    ┌──────────┐
    │   PM2    │ ──► Manages Express Backend (server/index.js)
    └──────────┘
         │
         ▼ Port 5432 (TCP)
    ┌──────────────────────┐
    │ AWS RDS (PostgreSQL) │
    └──────────────────────┘
```

---

## Step 1: AWS EC2 Instance & Security Groups

### 1.1 Recommended Instance Specs
- **AMI**: Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
- **Instance Type**: `t3.small` (2 vCPU, 2 GB RAM) or `t3.medium` (2 vCPU, 4 GB RAM)
- **Storage**: 20 GB gp3 SSD

### 1.2 Inbound Security Group Rules
Configure your EC2 Security Group inbound rules:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` (or Admin CIDR) | Remote terminal access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Web traffic (Let's Encrypt / HTTP) |
| **HTTPS**| TCP | `443`| `0.0.0.0/0` | Secure SSL web traffic |

### 1.3 RDS Security Group Rule (PostgreSQL)
Ensure your RDS PostgreSQL Security Group allows inbound connections on port `5432` from this EC2 instance's Security Group ID.

---

## Step 2: Connect and Install Dependencies

Connect to your EC2 instance via SSH:

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

Update system packages and install Node.js 20 LTS, Git, and Nginx:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20.x LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential

# 3. Verify installations
node -v   # Should be v20.x
npm -v    # Should be 10.x
nginx -v  # Should be 1.18+

# 4. Install PM2 globally
sudo npm install -g pm2
```

---

## Step 3: Clone Code & Configure Environment

```bash
# 1. Create web directory and set ownership
sudo mkdir -p /var/www/pkg-tracker
sudo chown -R ubuntu:ubuntu /var/www/pkg-tracker

# 2. Clone repository (or transfer code via rsync / git)
git clone <YOUR-GIT-REPO-URL> /var/www/pkg-tracker
cd /var/www/pkg-tracker

# 3. Install root, server, and client dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 3.1 Configure Backend `.env`
Create and configure `/var/www/pkg-tracker/server/.env`:

```bash
nano /var/www/pkg-tracker/server/.env
```

Paste your production settings:

```env
PORT=5001
NODE_ENV=production
CLIENT_URL=https://your-domain.com # or http://<EC2-PUBLIC-IP>
SESSION_SECRET=your_strong_random_secret_here_min_32_chars

# Database Configuration (AWS RDS PostgreSQL)
DB_HOST=packaging-production-db.c5a6gcg8u3rs.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=packaging_admin
DB_PASSWORD=YourSecureRdsPassword
DB_SSL_MODE=verify-full
DB_SSL_ROOT_CERT=./global-bundle.pem
```

*(If using AWS RDS, ensure `global-bundle.pem` exists in `server/`).*

### 3.2 Run Database Migrations & Seeds
Run database schema migrations and initial users seed:

```bash
cd /var/www/pkg-tracker/server
npm run db:setup
```

You should see:
```text
🐘 AWS RDS PostgreSQL Connected successfully!
🚀 Starting PostgreSQL Database Migrations...
   ✅ Successfully applied: 001_create_schema_migrations.sql ... 011_create_project_lifecycle_tables.sql
🌱 Seeding Users (Designated Team Members & Admins)...
   ✅ Seeded team members and Super Admin into PostgreSQL.
```

---

## Step 4: Build Client for Production

Build the optimized Vite production bundle:

```bash
cd /var/www/pkg-tracker/client
npm run build
```

This generates `/var/www/pkg-tracker/client/dist` containing `index.html` and bundled assets.

---

## Step 5: Start & Configure PM2

We provided [`ecosystem.config.cjs`](file:///c:/app-package/ecosystem.config.cjs) in the project root.

```bash
cd /var/www/pkg-tracker

# 1. Start application with PM2
pm2 start ecosystem.config.cjs --env production

# 2. Verify process is online
pm2 status

# 3. View live server logs
pm2 logs pkg-tracker-api --lines 50

# 4. Configure PM2 to restart automatically on EC2 reboot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# (Copy and run the sudo command that PM2 outputs if prompted)

# 5. Save the PM2 process list
pm2 save
```

Useful PM2 operational commands:
```bash
pm2 reload pkg-tracker-api   # Zero-downtime reload
pm2 restart pkg-tracker-api  # Full restart
pm2 monit                    # Terminal monitoring dashboard
```

---

## Step 6: Configure Nginx Reverse Proxy

### 6.1 Deploy Nginx Site Configuration
Copy the provided configuration template:

```bash
sudo cp /var/www/pkg-tracker/docs/nginx.conf /etc/nginx/sites-available/pkg-tracker
```

Edit the file to update your domain name or public IP:

```bash
sudo nano /etc/nginx/sites-available/pkg-tracker
```
*(Update `server_name your-domain.com www.your-domain.com;` to your real domain or EC2 Public IP / Public DNS).*

### 6.2 Enable Site & Test Nginx
```bash
# 1. Remove default Nginx welcome page
sudo rm -f /etc/nginx/sites-enabled/default

# 2. Enable pkg-tracker
sudo ln -sf /etc/nginx/sites-available/pkg-tracker /etc/nginx/sites-enabled/

# 3. Test configuration syntax
sudo nginx -t
# Output must be: syntax is ok, test is successful

# 4. Restart Nginx
sudo systemctl restart nginx
```

Now open `http://<EC2-PUBLIC-IP>` in your browser. The application will load immediately!

---

## Step 7: Configure HTTPS (Free Let's Encrypt SSL)

If you have a domain pointed to your EC2 Public IP:

```bash
# 1. Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain and install SSL certificate automatically
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 3. Follow prompts to redirect all HTTP traffic to HTTPS.
# Certbot will automatically edit /etc/nginx/sites-available/pkg-tracker to configure SSL.

# 4. Test auto-renewal
sudo certbot renew --dry-run
```

---

## Step 8: Zero-Downtime Deployment Script (`deploy.sh`)

Create `/var/www/pkg-tracker/deploy.sh` to update the application anytime you push code:

```bash
nano /var/www/pkg-tracker/deploy.sh
```

Paste:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Deployment..."
cd /var/www/pkg-tracker

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing server dependencies..."
cd server && npm install --omit=dev
npm run migrate

echo "🎨 Building frontend..."
cd ../client && npm install
npm run build

echo "🔄 Reloading PM2 backend..."
cd ..
pm2 reload ecosystem.config.cjs --env production

echo "🧹 Clearing Nginx cache / reloading..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
```

Make it executable:
```bash
chmod +x /var/www/pkg-tracker/deploy.sh
```

Whenever you have new changes, simply SSH in and run:
```bash
./deploy.sh
```
