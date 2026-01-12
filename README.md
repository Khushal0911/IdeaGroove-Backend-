# IdeaGroove Backend

## MySQL setup

1. Copy `.env.example` to `.env` and fill in your DB credentials:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=ideagroove
DB_PORT=3306
PORT=8080
```

2. Install dependencies and start server:

```
npm install
npm start
```

3. The backend will test the MySQL connection on startup. If connection fails the process exits.

4. To use the pool in code, import it in your modules:

```js
import pool from "./config/db.js";
// or use named testConnection helper:
import { testConnection } from "./config/db.js";
```
