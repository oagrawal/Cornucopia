const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Create a new pool for initialization (separate from our application pool)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default postgres database first
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

const dbName = process.env.DB_NAME || 'ingredient_db';

// Function to initialize the database
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Check if database exists
    const checkDbResult = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);
    
    // Create database if it doesn't exist
    if (checkDbResult.rows.length === 0) {
      console.log(`Creating database: ${dbName}`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created.`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
  } finally {
    client.release();
    await pool.end();
  }
  
  // Connect to the new database and run schema
  const appPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: dbName,
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  });
  
  const appClient = await appPool.connect();
  
  try {
    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying database schema...');
    await appClient.query(schema);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Error applying schema:', err);
  } finally {
    appClient.release();
    await appPool.end();
  }
}

// Run the initialization
initializeDatabase()
  .then(() => console.log('Database initialization complete.'))
  .catch(err => console.error('Database initialization failed:', err)); 