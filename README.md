# EliteElixir
The SubClientLogin packet handler in [Bedrock Dedicated Server](https://minecraft.wiki/w/Bedrock_Dedicated_Server) is vulnerable to various exploits such as crash exploits leading to [denial-of-service attacks](https://en.wikipedia.org/wiki/Denial-of-service_attack), and a user impersonation exploit which can lead to [privilege escalation](https://en.wikipedia.org/wiki/Privilege_escalation). These exploits can be utilized by an authenticated user, who is on the server's whitelist and has permission to join the server.

This repository will include an explanation of the exploit, a working proof-of-concept exploit tool which can be used to demonstrate the exploit on affected versions of BDS, and potential patches and remedies a server owner can take to protect themselves from the exploit.

# The Minecraft Bedrock Protocol
## Game Packets
Minecraft Bedrock GamePackets are sent over a [RakNet](https://github.com/facebookarchive/RakNet) connection. These GamePackets describe pretty much everything about the game state and are used to send the client and server information about game events, such as chunk spawning, block breaking, player joins, entity spawns, crafting items, etc. As of 1.19.70, there are around 200 different packets which describe a different game event.

Each of these GamePackets has header which starts with a varint value. This varint is 32 bits in size, and contains a bitfield describing the packet ID and sub client information. The first ten bits of the varint is used to store the packet ID, the next two bits are used to store the target subclient ID (so packets coming from the server to a client). The next two bits are used to identify the subclient sender ID. This means out of all 32 available bits, only 14 is used by the Minecraft Bedrock Protocol.

Console editions of the Minecraft Bedrock allow for split-screen play with up to four different players. The portion of the networking protocol relating to subclients is used to support split-screen play. This implementation means that instead of having to create a brand new RakNet connection for each splitscreen player, a single RakNet connection can be used.

An example of a varint value that would be inside a GamePacket is `11000000001001`. In the first ten bits, bit 0 and bit 3 are on, this results in a value of `9` which would identify the rest of the GamePacket as containing data for the Text packet. Bits 12 and 13 at the end are on, resulting a value of `4` which would identify that the packet was sent by a subclient whose ID is three.

## The Bedrock Authentication Procedure
When you connect to a server while logged into an Xbox account, your client sends a POST request to `https://multiplayer.minecraft.net/authentication/`, with the request body being Mojang's public key for signing authentication chains. The server responds with an array of JWTs that follows this format: `{ "chains": [ "JWTs Here" ] }`. The JWTs included in the chains include information such as your Xbox gamertag, Xbox User ID, the title ID you are currently playing on, and your UUID. The JWT is signed by Mojang's private key, so it is not possible to forge this data with other player's Xbox details **assuming the server checks the validity of the JWT**.

The client then establishes a RakNet connection to the server and sends a Login packet to the server; the format of the Login packet is as follows:
| Field             | Type   | Description                             |
| ----------------- | ------ | --------------------------------------- |
| Protocol Version  | Int32  | The protocol version used by the client |
| Certificate Chain | String | The certificate chain by the above API endpoint |
| Client Chain      | String | A self-signed JWT containing player device and skin skin data |

The protocol version is used by the server to determine if the game client is too old or new to connect. The certificate chain is the Mojang-signed JWTs from the `https://multiplayer.minecraft.net/authentication/` API endpoint, and the client chain contains information about your device and skin. The client chain is self-signed and can easily be manipulated, however it does not contain information such as XUIDs which could be used to log in as other players.

Upon receiving the Login packet by Bedrock Dedicated Server, it ensures that the JWTs in the chain was signed by Mojang's private key. If it is not, then the client will be in offline mode (if enabled in server.properties) with the XUID in the JWT stripped out. This is important as a player's XUID is used to identify what saved data belongs to who, and if a player could use any arbitrary XUID then they could load in other player's saved data.

## The Sub Client Login Packet
The SubClientLogin packet, similar to the Login packet, is used to authenticate a client to a server. Instead of this packet being used for the initial join, it is sent by each splitscreen instance upon creation. The format for this packet is as follows:

| Field             | Type   | Description                             |
| ----------------- | ------ | --------------------------------------- |
| Certificate Chain | String | The certificate chain by the above API endpoint |
| Client Chain      | String | A self-signed JWT containing player device and skin skin data |

The major difference here is that the protocol version field is removed, as the server has already validated that the server supports the player's version. Just like the Login packet, the certificate chain consists of JWTs from `https://multiplayer.minecraft.net/authentication/` and the client chain consists of a self-signed JWT about the player's device and skin. When sending the SubClientLogin packet, the packet ID in the GamePacket header must have an incremented subclient ID to identify which subclient is sending the packet.

When BDS recieves the SubClientLogin packet, it first ensures that another sub-client session isn't already active, and that the JWT is valid. The handling of the certficate chain JWTs in the Login packet and the SubClientLogin packet has **two very important differences**:
 - If the JWTs in the certificate chain is invalid (such as the JWT consisting of invalid base64 data, or the certificate being expired), then the **server will outright crash**.
 - **There is no checks to determine if the JWTs in the certificate chain was actually signed by Mojang's private key**.

This means that a player inside a Bedrock Dedicated Server may be able to crash the server by sending an invalid SubClientLogin packet, or send SubClientLogin packets with arbitrary XUIDs, or **XUIDS of other players, which allows a player to log in as other people**. In summary, the above flaws in the SubClientLogin packet handler can lead to:
 - Spoofing Account Gamertags
 - Spoofing Account XUIDs
 - Logging in as other players
   - Send any chat messages on a player's behalf
   - Send any commands on a player's behalf
   - Steal all the player's items
   - Get the player banned from Minecraft and potentially Xbox Live by sending chat messages with very vulgar and explicit content\*

\* Only works on Realms, as on Realms all chat messages are automatically forwarded to Mojang for review

## The ForceOP Exploit
Now that we have established that the SubClientLogin packet has no checks against whether the data in the certificate chain was actually signed by Mojang's private key, or that the data is even valid in the first place, we can now weaponize this for a ForceOP exploit. Since XUIDs are used to identify whose saved data belongs to who, we can send a SubClientLogin packet with a self-signed JWT containing the XUID of an Operator on the server. The server will spawn in a new sub-client player with the operator's XUID, which means our subclient will have Operator permissions. We can make our subclient send RequestPermissions packets to give our client Operator.

# Proof of Concept
To demonstrate the ForceOP exploit, this repository includes a PoC which uses the [bedrock-protocol](https://www.npmjs.com/package/bedrock-protocol) NPM package in order to connect to Minecraft Bedrock servers and send packets. This PoC has two operating modes which will depend if the exploit should be attempted on a Bedrock Dedicated Server or a Minecraft Realm. The first operating mode can be used by running `node . <IP> <PORT> <Target XUID> <offline>` in the terminal. The IP and PORT parameters are used to identify which BDS server to connect to, the Target XUID paramter is the player we should log into, and the offline parameter is used to log into the server as an offline account so we do not have to log into Xbox Live.

The second operating mode can be used to join Realms, it can be used by running `node src/realms.js`. Uponing running the `realm.js` script, you will be asked to log into an Xbox Live account through SISU authentication. This is used to get a list of Realms that you are inside, and be able the IP of the realm. Once authenticated, a list of Realms you are inside will be displayed along with an ID. You can type in the ID of the realm you want to connect to, which will attempt the exploit on that Realm.

When using this tool, you may notice that you will get disconnected with the disconnection reason of `disconnectionScreen.serverIdConflict`. This error usually happens when the player we are trying to impersonate is already in the server. You can get around this by setting the bot's name in the login chain to match the player's actual name (instead of the default `ImpersonatedUser`) which will get around the disconnection message. To keep the PoC simple, we do not include this part in the exploit.

# Protecting Yourself From SubClientLogin Exploits
Mojang has patched the user impersonation exploit (and thus ForceOP) in 1.19.80. The crash exploit involving invalid JWTs was patched by Mojang in 1.20.0. It is highly recommended that you go to https://www.minecraft.net/en-us/download/server/bedrock and download a modern version of BDS which contains patches for not just SubClientLogin related exploits, but various other exploits impacting older BDS versions. Incase you are unable to update your server to newer versions, you can apply remedies or patches depending on the server software you are using

## BDS
Install [LiteLoaderBDS](https://github.com/LiteLDev/LiteLoaderBDS), a plugin loader for BDS that adds a modding API to Bedrock Dedicated Server, and then follow the instructions for LiteLoaderBDS.

## Realms
Other than updating your Realm to modern versions of Minecraft, there are no available patches for SubClientLogin related exploits. A remedy to try and mitigate the exploit is possible.

When the ForceOP exploit is attempted on a realm, the `permissions.json` file is updated to include the attacker's XUID as an operator, however the actual permissions on the Realms GUI does not show the player as having operator as Realms have a seperate `permissions.json` file which cannot be modified by the BDS server. When a player leaves or joins a Realm Club, the Realms API automatically copies the proper `permissions.json` file to the BDS server which removes the attacker's XUID as having operator. This means that if you were to make a script that constantly joins and leaves your Realm Club, you can make it so players who attempt the exploit on your Realm will lose their operator status, helping to mitigate the exploit. This isn't perfect, as players can still log into your Realm with your XUID and run any commands on your behalf which can be used to destroy your Realm.

## BDSX
\@kaito02020424 created a plugin which will block all SubClientLogin packets, protecting your server from both the crash exploit and the user impersonation exploit. You can find the plugin at https://discord.com/channels/646456965983240212/1105446951060779128/1105446951060779128.

## LiteLoaderBDS
Add the plugin [SubLoginPatch](https://github.com/ShrBox/SubLoginPatch) by \@ShrBox to your server. This plugin automatically blocks all SubClientLogin packets, protecting your server from both the crash exploit and the user-impersonation exploit. This does break split-screen play, however.

# Disclaimer
This tool is reserved for EDUCATIONAL PURPOSES ONLY. I do not endorse the usage of this tool for non-ethical purposes and I will not be held liable for the actions caused by this tool. It is merely a way to show that this type of stuff is possible, and so the affected software (in this case, Bedrock Dedicated Server) can patch such exploit.