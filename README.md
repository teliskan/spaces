# Import Circuit conversation members to Space

This Circuit bot application syncs the members of a Circuit Space with the members of a Circuit conversation. In order to make it work you need the bot user need to be member both the Circuit conversation and space. The bot compares the list of participants from the Circuit conversation with the list of participants from the Space and based on the diff it adds/removes users from the Space.

# Steps to execute
1. Install node.js (https://nodejs.org/en/download/). Make sure it is added in your system PATH variable. You can check that it is installed with success by executing "node -v" in a Windows
2. Download the bot from github 
     2.1. Visit https://github.com/teliskan/spaces
     2.2. Click "Clone or download"
     2.3. Click "Download ZIP"
3. Exrtract the downloaded zip file
4. Using a terminal navigate inside the extracted folder
5. Execute "npm install" to install the necessary dependencies for the bot
6. Run the bot with the following command "node index.js"

After the execution two reports are generated one with the users added to the Space and one with the user removed. A report is not generated in case it not needed. (eg. when no users were found)
