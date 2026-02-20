# deploy_ps.ps1 — PowerShell version of deploy_titleclash.sh
# Workaround for bash stdout pipe issue in this session
$ErrorActionPreference = "Continue"
Set-Location C:\Projects\appback-platform\title-clash

$EC2 = "43.201.163.136"
$KEY = "appback.pem"
$SSH = @("-i", $KEY, "-o", "StrictHostKeyChecking=no", "ec2-user@$EC2")
$TAR = "C:\tmp\titleclash-images.tar"

Write-Output "=========================================="
Write-Output " Deploying Title-Clash to AWS (PowerShell)"
Write-Output "=========================================="

# 1. Build
Write-Output "[1/5] Building Docker images..."
if (Test-Path apps\api\_common) { Remove-Item -Recurse -Force apps\api\_common }
Copy-Item -Recurse ..\packages\common apps\api\_common
docker build -t titleclash-api:latest apps/api/ 2>&1 | Select-Object -Last 3
Remove-Item -Recurse -Force apps\api\_common
docker build -t titleclash-client:latest client/ 2>&1 | Select-Object -Last 3
Write-Output "  Images built."

# 2. Save + Transfer
Write-Output "[2/5] Saving and transferring images..."
docker save titleclash-api:latest titleclash-client:latest -o $TAR
$sizeMB = [math]::Round((Get-Item $TAR).Length / 1MB, 1)
Write-Output "  Tar size: ${sizeMB}MB. Transferring..."
scp -i $KEY -o StrictHostKeyChecking=no $TAR "ec2-user@${EC2}:/tmp/"
Remove-Item -Force $TAR
Write-Output "  Images transferred."

# 3. Upload configs + load
Write-Output "[3/5] Setting up EC2..."
ssh @SSH "mkdir -p /home/ec2-user/titleclash/docker /home/ec2-user/titleclash/db/migrations"
scp -i $KEY -o StrictHostKeyChecking=no docker/docker-compose.prod.yml "ec2-user@${EC2}:/home/ec2-user/titleclash/docker/"
scp -i $KEY -o StrictHostKeyChecking=no docker/nginx-host.conf "ec2-user@${EC2}:/home/ec2-user/titleclash/docker/"
scp -i $KEY -o StrictHostKeyChecking=no -r db/migrations/ "ec2-user@${EC2}:/home/ec2-user/titleclash/db/migrations/"
ssh @SSH "docker load -i /tmp/titleclash-images.tar; rm -f /tmp/titleclash-images.tar"
Write-Output "  EC2 ready."

# 4. Start services
Write-Output "[4/5] Starting services..."
ssh @SSH "cd /home/ec2-user/titleclash/docker && docker compose -f docker-compose.prod.yml up -d"
Write-Output "  Waiting for API..."
Start-Sleep -Seconds 5
for ($i = 1; $i -le 15; $i++) {
    $health = ssh @SSH "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/health"
    if ($health -eq "200") {
        Write-Output "  API: OK (attempt $i)"
        break
    }
    if ($i -eq 15) {
        Write-Output "  WARNING: API health check failed (HTTP $health)"
        ssh @SSH "cd /home/ec2-user/titleclash/docker && docker compose -f docker-compose.prod.yml logs --tail=20 api"
    } else {
        Write-Output "  Attempt $i/15 (HTTP $health)..."
        Start-Sleep -Seconds 2
    }
}

# 5. Status
Write-Output "[5/5] Service status:"
ssh @SSH "cd /home/ec2-user/titleclash/docker && docker compose -f docker-compose.prod.yml ps"

Write-Output ""
Write-Output "=========================================="
Write-Output " Deploy Complete!"
Write-Output "=========================================="
Write-Output " https://titleclash.com"
Write-Output "=========================================="
