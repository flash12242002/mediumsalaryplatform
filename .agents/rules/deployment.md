---
description: Constraints for deploying and running the HR Platform
trigger: always_on
---

# Deployment Constraints

When working on this project (HR Platform), STRICTLY ADHERE to the following deployment rules:

1. **NEVER run `npm run dev`, `npm start`, or `nodemon` manually on the VM.**
   The server is managed by `pm2` in the background. Running it manually will cause port 3000 conflicts and result in stale UI being served.
   
2. **NEVER start `ngrok` manually.**
   A persistent `ngrok-tunnel` process is already managed by `pm2`.

3. **Always use the one-shot deploy script.**
   After committing and pushing changes to GitHub, instruct the user to deploy on their VM using:
   `bash ~/deploy.sh`
   This script handles pulling, installing dependencies, port management, and `pm2` restarts automatically.
