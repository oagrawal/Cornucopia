const db = require('../config/db');

// Get all ingredients
const getAllIngredients = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM ingredients');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get ingredient by name
const getIngredientByName = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM ingredients WHERE name ILIKE $1',
            [req.params.name]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add new ingredient
const addIngredient = async (req, res) => {
    const { name, category, quantity, expiryDate, brand } = req.body;
    
    // Validate required fields
    if (!name || !category || !quantity) {
        return res.status(400).json({ 
            message: 'Required fields: name, category, quantity' 
        });
    }
    
    try {
        // Check for duplicates
        const checkResult = await db.query(
            'SELECT * FROM ingredients WHERE name ILIKE $1',
            [name]
        );
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ message: 'Ingredient already exists' });
        }
        
        // Insert new ingredient
        const result = await db.query(
            `INSERT INTO ingredients (name, category, quantity, expiry_date, brand) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [name, category, quantity, expiryDate, brand]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update ingredient
const updateIngredient = async (req, res) => {
    const { name: paramName } = req.params;
    const { name, category, quantity, expiryDate, brand } = req.body;
    
    try {
        // Check if ingredient exists
        const checkResult = await db.query(
            'SELECT * FROM ingredients WHERE name ILIKE $1',
            [paramName]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        
        // Update fields that are provided
        const result = await db.query(
            `UPDATE ingredients 
             SET name = COALESCE($1, name),
                 category = COALESCE($2, category),
                 quantity = COALESCE($3, quantity),
                 expiry_date = COALESCE($4, expiry_date),
                 brand = COALESCE($5, brand)
             WHERE name ILIKE $6
             RETURNING *`,
            [name, category, quantity, expiryDate, brand, paramName]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete ingredient
const deleteIngredient = async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM ingredients WHERE name ILIKE $1 RETURNING *',
            [req.params.name]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllIngredients,
    getIngredientByName,
    addIngredient,
    updateIngredient,
    deleteIngredient
}; 