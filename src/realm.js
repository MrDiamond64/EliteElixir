const prompt = require("prompt-sync")();
const RealmsAPI = require("./RealmsAPI.js");
const Payload = require("./payload.js");

(async () => {
	const API = new RealmsAPI();
	await API.auth();

	const allRealms = await API.getRealmsList();
	allRealms.sort((a, b) => a.id - b.id);

	if(allRealms.length === 0) {
		console.warn("The account you linked with is not inside any realms");
		process.exit(1);
	}

	for(const i in allRealms) {
		const realm = allRealms[i];
		if(realm.state === "CLOSED" || realm.expired) continue;

		console.log(`${Number(i) + 1}. ${realm.name}`);
	}

	const selection = Number(prompt("Please type in the number for the realm, or the realm ID: "));

	const realm = allRealms[selection - 1] ? allRealms[selection - 1] : allRealms.find(realmData => realmData.id === selection);
	if(!realm) {
		console.log("Invalid choice.");
		process.exit(0);
	}

	console.log(`Connecting to ${realm.name} (${realm.id})...`);

	const realmAddress = await API.getRealmAddress(realm.id);

	new Payload({
		targetXuid: realm.ownerUuid,
		ip: realmAddress.ip,
		port: realmAddress.port
	});
})();