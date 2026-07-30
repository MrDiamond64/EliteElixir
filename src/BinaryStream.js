const { SmartBuffer } = require("smart-buffer");
const UUID = require("uuid");

class BinaryStream extends SmartBuffer {
	writeVarInt(value) {
		do {
			const byte = value & 0x7F;
			value >>>= 7;
			const bytesRemaining = value !== 0;
			this.writeUInt8(byte | (bytesRemaining ? 0x80 : 0));
		} while (value !== 0);
	}

	writeSignedVarInt(value) {
		value = (value << 1) ^ (value >> 31);

		this.writeVarInt(value);
	}

	writeVarintString(string) {
		const byteLength = Buffer.byteLength(string, "utf8");

		this.writeVarInt(byteLength); // Length
		this.writeString(string);
	}

	// LoginPacket and SubClientLoginPacket expect a string with a length value as a little endian integer
	writeLEString(string) {
		const byteLength = Buffer.byteLength(string, "utf8");

		this.writeInt32LE(byteLength); // Length
		this.writeString(string);
	}

	writeBool(value) {
		this.writeUInt8(value ? 1 : 0);
	}

	writeUuid(uuid) {
		const bytes = UUID.parse(uuid);

		// UUIDs are 128 bits, so in the Minecraft Bedrock Protocol they are divided between two little-endian int64s
		// UUID.parse returns a Uint8Array with 16 elements, as they are all 8 bits this will always write 128 bits
		for(const u8 of bytes) {
			this.writeUInt8(u8); // Each part of the UUID
		}
	}
}

module.exports = BinaryStream