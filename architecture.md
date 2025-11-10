# Architecture

This project is a monorepo containing a web application with a client-server architecture.

## Key Components

- **Frontend:** A React-based single-page application (SPA) located in the `client` directory. It's responsible for the user interface and all client-side logic.
- **Backend:** A Node.js server, likely using the Express.js framework, located in the `server` directory. It handles business logic, data processing, and communication with the database.
- **Database:** A PostgreSQL database is used for data persistence. The database schema and migrations are managed through SQL files in the `sql` and `database_migrations` directories.
- **API:** The backend exposes a RESTful API for the client to consume. The API routes are defined in the `server/routes` directory.

## Deployment

The project is configured for deployment on both Netlify and Vercel, as indicated by the `netlify.toml` and `vercel.json` configuration files. Serverless functions are used, with some located in the `netlify/functions` directory.

## Development

The monorepo structure allows for unified dependency management and streamlined development across the client and server. The root `package.json` likely contains scripts for managing the entire project.
