# EliteElixir
The first ever MC:BE ForceOP Exploit utilizing a user impersonation exploit within Bedrock Dedicated Server

This tool uses the sub_client_login with the realm owners XUID. The server does not validate if the user authenticated to Xbox Live and lets the sub client join. From there, we send a request permissions packet to give ourselves operator.

# Capabilities of this exploit
Using this exploit, you can:
  - Spoof an accounts XUID
  - Spoof an accounts gamertag
  - Log in as other people
    - Send any commands as them
    - Send any chat commands as them (which can also be used to get anyone false banned from Minecraft and potentially Xbox Live)
    - Steal all their items

# How to send the packets
Sub clients have special packet IDs served for them. It is the normal packet id plus 4096. (Example: A text packet has the id of 9, so it would have the packet id of 4105)
For sub client 2 you will have to add 8192 to the packet ID, and for sub client 3 you will add 12288 to the packet id.

# Warning
This tool is reserved for EDUCATIONAL PURPOSES ONLY. I do not endorse the usage of this tool and I will not be held liable for the actions caused by this tool. It is merely a way to show that this type of stuff is possible, and so the affected software (in this case, Bedrock Dedicated Server) can patch such exploit.
