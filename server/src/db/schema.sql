-- Drop tables if they exist (for clean initialization)
DROP TABLE IF EXISTS ingredients;

-- Create ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL NOT NULL,
  expiry_date DATE,
  brand VARCHAR(100)
);

-- Insert initial data
INSERT INTO ingredients (name, category, quantity, expiry_date, brand)
VALUES 
  ('Tomatoes', 'Produce', 5, '2024-03-25', NULL),
  ('Heinz Ketchup', 'Condiments and Beverages', 1, '2024-06-15', 'Heinz'),
  ('Sliced Turkey', 'Sliced/Pre-Prepared Raw Ingredients', 200, '2024-03-20', 'Butterball'); 