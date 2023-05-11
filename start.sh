echo "EliteElixir // created by ussr (discord id: 952069372069937172)"

if [ ! -d "./authCache/" ]; then
  mkdir authCache
fi

if [ ! -f package-lock.json ]; then
  npm i
fi

while true; do
  node .
done
