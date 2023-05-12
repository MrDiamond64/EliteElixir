# EliteElixir
The first ever MC:BE ForceOP Exploit utilizing a user impersonation exploit within Bedrock Dedicated Server

This tool uses the sub_client_login (the packet used for split screen) with the realm owners XUID. The server does not validate if the user authenticated to Xbox Live and lets the sub client join. From there, we send a request permissions packet to give ourselves operator.

# How to use
The tool is almost competely automatic, it does not require you to edit anything in the code. You will need to download the source code by using `git clone https://github.com/MrDiamond64/EliteElixir.git`, then go to the directory called "EliteElixir" and open start.bat (open start.sh if your on Linux). If its your first time using the tool, it will ask you to link your account, go to the link and follow the instructions.

Once you have linked your account, a list of all the realms your inside (excluding closed and expired realms) will show along with a number beside it. You can type that number or the Realm ID and it will give you operator on that realm.

If your getting disconnectionScreen.serverIdConflict then that means your linked account is inside the realm, on your other device leave the realm and retry.

If you want to link a different account with the tool, run `reset_accounts.bat` (or `reset_accounts.sh` if your on Linux) and reopen the too.

# Capabilities of this exploit
Using this exploit, you can:
  - Spoof an accounts XUID
  - Spoof an accounts gamertag
  - Log in as other people
    - Send any commands as them
    - Send any chat commands as them (which can also be used to get anyone false banned from Minecraft and potentially Xbox Live)
    - Steal all their items

# Config
You can edit some options in the config.json file.

`botName` is the name of the bot that will join the Realm.

`commands` is an array of all the commands that will run

`messages` is an array of messages that the bot will run as the Realm Owner. You can make the realm owner say extremely nasty stuff to get them banned, or run any chat commands.

# How to send the packets
Sub clients have special packet IDs served for them. It is the normal packet id plus 4096. (Example: A text packet has the id of 9, so it would have the packet id of 4105)
For sub client 2 you will have to add 8192 to the packet ID, and for sub client 3 you will add 12288 to the packet id.

# Disclaimer
This tool is reserved for EDUCATIONAL PURPOSES ONLY. I do not endorse the usage of this tool and I will not be held liable for the actions caused by this tool. It is merely a way to show that this type of stuff is possible, and so the affected software (in this case, Bedrock Dedicated Server) can patch such exploit.
