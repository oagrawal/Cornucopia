# Server with PostgreSQL Database

This server uses PostgreSQL as its database backend. Follow these steps to set up and run the application.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL installed and running

## Setup Instructions

1. Install dependencies:

   ```
   npm install
   ```

2. Configure the database:

   - Open `.env` file in the server root directory
   - Update the PostgreSQL connection details (user, password, etc.)
   - Make sure your PostgreSQL server is running

3. Initialize the database:

   ```
   npm run init-db
   ```

   This will create the database and tables if they don't exist.

4. Start the server:
   ```
   npm run dev
   ```
   The server will be available at http://localhost:3000

## API Endpoints

- `GET /api/ingredients` - Get all ingredients
- `GET /api/ingredients/:name` - Get ingredient by name
- `POST /api/ingredients` - Add new ingredient
- `PUT /api/ingredients/:name` - Update ingredient
- `DELETE /api/ingredients/:name` - Delete ingredient

## Database Schema

The database has a single table `ingredients` with the following columns:

- `id` - SERIAL PRIMARY KEY
- `name` - VARCHAR(100) NOT NULL UNIQUE
- `category` - VARCHAR(100) NOT NULL
- `quantity` - DECIMAL NOT NULL
- `expiry_date` - DATE
- `brand` - VARCHAR(100)

## Troubleshooting

- If you get a "password authentication failed" error, make sure your PostgreSQL credentials in the `.env` file are correct.
- Ensure your PostgreSQL server is running before starting the application.
- If you need to reset the database, you can run `npm run init-db` again (this will drop and recreate the tables).
