#!/bin/bash
# Dev: backend (3000) + frontend dev server (5173). Production: `cd server && npm start`.
cd "$(dirname "$0")/server" && node index.js
