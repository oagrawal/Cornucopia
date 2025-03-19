const ingredients = require('../data/ingredients');

// Get all ingredients
const getAllIngredients = (req, res) => {
    res.json(ingredients);
};

// Get ingredient by name
const getIngredientByName = (req, res) => {
    const ingredient = ingredients.find(i => 
        i.name.toLowerCase() === req.params.name.toLowerCase()
    );
    
    if (!ingredient) {
        return res.status(404).json({ message: 'Ingredient not found' });
    }
    
    res.json(ingredient);
};

// Add new ingredient
const addIngredient = (req, res) => {
    const newIngredient = req.body;
    
    // Validate required fields
    if (!newIngredient.name || !newIngredient.category || 
        !newIngredient.quantity || !newIngredient.unit) {
        return res.status(400).json({ 
            message: 'Required fields: name, category, quantity, unit' 
        });
    }
    
    // Check for duplicates
    if (ingredients.some(i => i.name.toLowerCase() === newIngredient.name.toLowerCase())) {
        return res.status(400).json({ message: 'Ingredient already exists' });
    }
    
    ingredients.push(newIngredient);
    res.status(201).json(newIngredient);
};

// Update ingredient
const updateIngredient = (req, res) => {
    const index = ingredients.findIndex(i => 
        i.name.toLowerCase() === req.params.name.toLowerCase()
    );
    
    if (index === -1) {
        return res.status(404).json({ message: 'Ingredient not found' });
    }
    
    // Preserve existing values if not provided in update
    ingredients[index] = {
        ...ingredients[index],
        ...req.body
    };
    
    res.json(ingredients[index]);
};

// Delete ingredient
const deleteIngredient = (req, res) => {
    const index = ingredients.findIndex(i => 
        i.name.toLowerCase() === req.params.name.toLowerCase()
    );
    
    if (index === -1) {
        return res.status(404).json({ message: 'Ingredient not found' });
    }
    
    ingredients.splice(index, 1);
    res.status(204).send();
};

module.exports = {
    getAllIngredients,
    getIngredientByName,
    addIngredient,
    updateIngredient,
    deleteIngredient
}; 