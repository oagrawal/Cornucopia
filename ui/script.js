// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const ingredientsList = document.getElementById('ingredients-list');
const recipesList = document.getElementById('recipes-list');

// State management
let currentIngredients = [];
let currentRecipes = [];

// Tab switching functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        
        // Update active states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

// Function to render ingredients
function renderIngredients(ingredients) {
    // Add headers first
    const headerHtml = `
        <div class="ingredients-header">
            <div class="header-item">Name</div>
            <div class="header-item">Category</div>
            <div class="header-item">Quantity</div>
            <div class="header-item">Expiry Date</div>
            <div class="header-item">Brand</div>
        </div>
    `;

    const ingredientsHtml = ingredients.map(ingredient => `
        <div class="ingredient-card">
            <div class="ingredient-content">
                <div class="ingredient-field">
                    <span class="field-label">Name</span>
                    <span class="field-value">${ingredient.name}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Category</span>
                    <span class="field-value ${ingredient.category.toLowerCase().replace(/\s+/g, '-')}">${ingredient.category}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Quantity</span>
                    <span class="field-value">${ingredient.quantity} ${ingredient.unit}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Expiry Date</span>
                    <span class="field-value">${formatDate(ingredient.expiryDate)}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Brand</span>
                    <span class="field-value">${ingredient.brand || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');

    ingredientsList.innerHTML = headerHtml + ingredientsHtml;
}

// Function to render recipes
function renderRecipes(recipes) {
    recipesList.innerHTML = recipes.map(recipe => `
        <div class="recipe-card">
            <h3>${recipe.name}</h3>
            <p>${recipe.description}</p>
            <div class="recipe-ingredients">
                <strong>Required Ingredients:</strong>
                <ul>
                    ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

// API configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Function to fetch ingredients from backend
async function fetchIngredients() {
    try {
        const response = await fetch(`${API_BASE_URL}/ingredients`);
        const data = await response.json();
        currentIngredients = data;
        renderIngredients(currentIngredients);
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        ingredientsList.innerHTML = '<p class="error">Failed to load ingredients</p>';
    }
}

// Function to fetch recipe recommendations
async function fetchRecipes() {
    try {
        const response = await fetch(`${API_BASE_URL}/recipes`);
        const data = await response.json();
        currentRecipes = data;
        renderRecipes(currentRecipes);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        recipesList.innerHTML = '<p class="error">Failed to load recipes</p>';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    fetchIngredients();
    fetchRecipes();
}); 