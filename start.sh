echo "NoMoreFairPlay // created by ussr (discord id: 952438450441838592) | Uptime: 0 seconds - Total Crashes: 0"

if [ ! -d "./authCache/" ]; then
  mkdir authCache
fi

if [ ! -f package-lock.json ]; then
  npm i
fi

while true; do
  node .
done