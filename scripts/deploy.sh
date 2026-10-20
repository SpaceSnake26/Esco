#!/usr/bin/env bash
# Deploy Esco (Spanish Quest) to the VPS behind Caddy at esco.alpbot.ch.
set -euo pipefail
VPS=178.104.249.249
DEST=/opt/esco

echo "→ syncing source to $VPS:$DEST"
ssh "$VPS" "mkdir -p $DEST"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude 'server/data' \
  --exclude '.env' --exclude 'client/dist' --exclude '.superpowers' \
  ./ "$VPS:$DEST/"

echo "→ installing deps (root + server + client), building, migrating, seeding on VPS"
ssh "$VPS" "cd $DEST && npm install && npm --prefix server install && npm --prefix client install && npm run build && npm run migrate && (npm run seed || true)"

echo "→ installing/refreshing systemd unit"
ssh "$VPS" "cp $DEST/scripts/esco-api.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now esco-api && systemctl restart esco-api"

echo "→ done. Check: systemctl status esco-api && curl -s https://esco.alpbot.ch/api/health"
