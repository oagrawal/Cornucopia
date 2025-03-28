const express = require('express');
const router = express.Router();
const {
    getAllIngredients,
    getIngredientById,
    addIngredient,
    updateIngredient,
    deleteIngredient
} = require('../controllers/ingredientController');

// Middleware to parse JSON bodies
router.use(express.json());

// GET all ingredients
router.get('/', getAllIngredients);

// GET ingredient by id
router.get('/:id', getIngredientById);

// POST new ingredient
router.post('/', addIngredient);

// PUT update ingredient
router.put('/:id', updateIngredient);

// DELETE ingredient
router.delete('/:id', deleteIngredient);

module.exports = router; 