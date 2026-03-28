#!/bin/bash
# Start user-frontend dev server
cd "$(dirname "$0")/user-frontend" || exit 1
exec npx vite --host
