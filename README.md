# Sync Circuit conversation members with Space

This Circuit bot application syncs the members of a Circuit Space with the members of a Circuit conversation. In order to make it work you need the bot user need to be member both the Circuit conversation and space. The bot compares the list of participants from the Circuit conversation with the list of participants from the Space and based on the diff it adds/removes users from the Space.

# Steps to execute
1. Install node.js (https://nodejs.org/en/download/). Make sure your system PATH variable is properly updated so that you can use node from Windows command prompt (usually Windows installer will prompt you to add it automatically). You can check that it is installed with success and PATH variable is prorerly configured by executing "node -v" in a Windows command prompt
2. Download the bot from github 
     2.1. Visit https://github.com/teliskan/spaces
     2.2. Click "Clone or download"
     2.3. Click "Download ZIP"
3. Exrtract the downloaded zip file
4. Using a terminal navigate inside the extracted folder
5. Modify the config.json and provide the proper values for the client_id/client_secret (treat with proper security), conversationId(the ID of the circuit conversation) and spaceId (the ID of the space conversation). The last two could be extracted from the browser URL bar eg. when you have nagigated in the Circuit conversation you want the URL changes to https://eu.yourcircuit.com/#/conversation/dfe20623-2aa6-463f-b53d-a79c7ea732c6 and the conversationId is dfe20623-2aa6-463f-b53d-a79c7ea732c6)
6. Execute "npm install" to install the necessary dependencies for the bot
7. Run the bot with the following command "node index.js"

After the execution two reports are generated one with the users added to the Space and one with the user removed. A report is not generated in case it not needed. (eg. when no users were found)
