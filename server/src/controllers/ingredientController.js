const db = require('../config/db');

// Get all ingredients
const getAllIngredients = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM ingredients ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get ingredient by id
const getIngredientById = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM ingredients WHERE id = $1',
            [req.params.id]
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
    const { name, category, quantity, expiry_date, brand } = req.body;
    
    // Validate required fields
    if (!name || !category || quantity === undefined) {
        return res.status(400).json({ 
            message: 'Required fields: name, category, quantity' 
        });
    }
    
    try {
        // Insert new ingredient
        const result = await db.query(
            `INSERT INTO ingredients (name, category, quantity, expiry_date, brand) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [name, category, quantity, expiry_date || null, brand || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update ingredient
const updateIngredient = async (req, res) => {
    const { id } = req.params;
    const { name, category, quantity, expiry_date, brand } = req.body;
    
    try {
        // Check if ingredient exists
        const checkResult = await db.query(
            'SELECT * FROM ingredients WHERE id = $1',
            [id]
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
             WHERE id = $6
             RETURNING *`,
            [name, category, quantity, expiry_date, brand, id]
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
            'DELETE FROM ingredients WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Ingredient not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllIngredients,
    getIngredientById,
    addIngredient,
    updateIngredient,
    deleteIngredient
}; 