const express = require('express');
const router = express.Router();
const {
    getAllIngredients,
    getIngredientByName,
    addIngredient,
    updateIngredient,
    deleteIngredient
} = require('../controllers/ingredientController');

// GET all ingredients
router.get('/', getAllIngredients);

// GET ingredient by name
router.get('/:name', getIngredientByName);

// POST new ingredient
router.post('/', addIngredient);

// PUT update ingredient
router.put('/:name', updateIngredient);

// DELETE ingredient
router.delete('/:name', deleteIngredient);

module.exports = router; 