const fetch = require("node-fetch");
const { Authflow, Titles } = require("prismarine-auth");

const flow = new Authflow(undefined, "./authCache/", {
	flow: "live",
	authTitle: Titles.MinecraftNintendoSwitch,
	deviceType: "Nintendo",
	doSisuAuth: true
});

class RealmsAPI {
	BASE_URL = "https://pocket.realms.minecraft.net/";

	constructor() {
		this.headers = {
			"authorization": "",
			"charset": "utf-8",
			"client-ref": "8582b58a5cb47d5beee984d20ee8995c9a50a3f1",
			"client-version": "1.19.70",
			"content-type": "application/json",
			"user-agent": "MCPE/UWP",
			"Accept-Language": "en-US",
			"Accept-Encoding": "gzip, deflate, br",
			"Connection": "Keep-Alive"
		};
	}

	async auth() {
		const xboxToken = await flow.getXboxToken(this.BASE_URL);
		this.headers.authorization = `XBL3.0 x=${xboxToken.userHash};${xboxToken.XSTSToken}`;
	}

	async getRealmsList() {
		const response = await fetch(this.BASE_URL + "worlds", {
			method: "GET",
			headers: this.headers
		});

		if(response.status !== 200) {
			throw Error(`Failed to get player realms list, status code: ${response.status}`);
		}

		const { servers: allRealms } = await response.json();

		return allRealms;
	}

	async getRealmAddress(realmId) {
		const response = await fetch(this.BASE_URL + `worlds/${realmId}/join`, {
			method: "GET",
			headers: this.headers
		});

		if(response.status !== 200) {
			throw Error(`Failed to get address for realm ${realmId}, status code: ${response.status}`);
		}

		const { address } = await response.json();
		const [ ip, port ] = address.split(":");

		return {
			ip: ip,
			port: Number(port)
		};
	}
}

module.exports = RealmsAPI;