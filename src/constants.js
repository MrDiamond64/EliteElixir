const AdventureFlags = {
    WORLD_IMMUTABLE: (1 << 0),
    NO_PVP: (1 << 1),
    AUTO_JUMP: (1 << 5),
    ALLOW_FLIGHT: (1 << 6),
    NOCLIP: (1 << 7),
    WORLD_BUILDER: (1 << 8),
    FLYING: (1 << 9),
    MUTED: (1 << 10)
}

const CommandOriginType = {
    PLAYER: 0,
    BLOCK: 1,
    MINECART: 2,
    DEV_CONSOLE: 3,
    TEST: 4,
    AUTOMATION: 5,
    CLIENT_AUTOMATION: 6,
    DEDICATED_SERVER: 7,
    ENTITY: 8,
    VIRTUAL: 9,
    GAME_ARGUMENT: 10,
    ENTITY_SERVER: 11,
    PRECOMPILED: 12,
    GAME_DIRECTOR_ENTITY_SERVER: 13,
    SCRIPT: 14,
    EXECUTOR: 15
}

const CommandPermissionLevel = {
    ANY: 0,
    GAME_MASTER: 1,
    ADMIN: 2,
    HOST: 3,
    OWNER: 4,
    INTERNAL: 5
}

// Player device value
const DeviceOS = {
    UNDEFINED: 0,
    ANDROID: 1,
    IOS: 2,
    OSX: 3,
    FIRE_OS: 4,
    GEARVR: 5,
    HOLOLENS: 6,
    WINDOWS_10: 7,
    WINDOWS_32: 8,
    DEDICATED_SERVER: 9,
    TVOS: 10,
    ORBIS: 11,
    SWITCH: 12,
    XBOX: 13,
    WINDOWS_PHONE: 14,
    LINUX: 15
}

// Identifier for a player's input method
const InputModes = {
    UNDEFINED: 0,
    MOUSE: 1,
    TOUCH: 2,
    GAMEPAD: 3,
    MOTION_CONTROLLER: 4
};

// IDs for all the various game packets
const PacketIds = {
    TEXT: 9,
    ADVENTURE_SETTINGS: 55,
    COMMAND_REQUEST: 77,
    SUB_CLIENT_LOGIN: 94,
    REQUEST_PERMISSIONS: 185,
};

const PermissionFlags = {
    BUILD: (1 << 0),
    MINE: (1 << 1),
    DOORS_AND_SWITCHES: (1 << 2),
    OPEN_CONTAINERS: (1 << 3),
    ATTACK_PLAYERS: (1 << 4),
    ATTACK_MOBS: (1 << 5),
    OPERATOR: (1 << 6),
    TELEPORT: (1 << 7),
}

const PermissionLevel = {
    VISITOR: 0,
    MEMBER: 1,
    OPERATOR: 2,
    CUSTOM: 3
}

// Identifier for the type of Text packet
// Only Chat is accepted by the server
const TextType = {
    RAW: 0,
    CHAT: 1,
    TRANSLATION: 2,
    POPUP: 3,
    JUKEBOX_POPUP: 4,
    TIP: 5,
    SYSTEM: 6,
    WHISPER: 7,
    ANNOUNCEMENT: 8,
    JSON_WHISPER: 9,
    JSON: 10,
    JSON_ANNOUNCEMENT: 11
}

module.exports = {
    AdventureFlags,
    CommandOriginType,
    CommandPermissionLevel,
    DeviceOS,
    InputModes,
    PacketIds,
    PermissionFlags,
    PermissionLevel,
    TextType
}