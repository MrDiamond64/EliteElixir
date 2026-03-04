const { SmartBuffer } = require("smart-buffer");

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
		this.writeVarInt(string.length); // Length
		this.writeString(string);
	}

	// LoginPacket and SubClientLoginPacket expect a string with a length value as a little endian integer
	writeLEString(string) {
		this.writeInt32LE(string.length); // Length
		this.writeString(string);
	}

	writeBool(value) {
		this.writeUInt8(value ? 1 : 0);
	}
}

module.exports = BinaryStream