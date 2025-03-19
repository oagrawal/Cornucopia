// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const ingredientsList = document.getElementById('ingredients-list');
const recipesList = document.getElementById('recipes-list');
const showAddFormBtn = document.getElementById('show-add-form');
const addIngredientForm = document.getElementById('add-ingredient-form');
const ingredientForm = document.getElementById('ingredient-form');
const cancelAddBtn = document.getElementById('cancel-add');

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

// Show/hide add ingredient form
showAddFormBtn.addEventListener('click', () => {
    addIngredientForm.classList.remove('hidden');
    showAddFormBtn.classList.add('hidden');
});

cancelAddBtn.addEventListener('click', () => {
    addIngredientForm.classList.add('hidden');
    showAddFormBtn.classList.remove('hidden');
    ingredientForm.reset();
});

// Handle ingredient form submission
ingredientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newIngredient = {
        name: document.getElementById('ingredient-name').value,
        category: document.getElementById('ingredient-category').value,
        quantity: parseInt(document.getElementById('ingredient-quantity').value),
        expiry_date: document.getElementById('ingredient-expiry').value || null,
        brand: document.getElementById('ingredient-brand').value || null
    };
    
    try {
        await addIngredient(newIngredient);
        // Reset form and hide it
        ingredientForm.reset();
        addIngredientForm.classList.add('hidden');
        showAddFormBtn.classList.remove('hidden');
        // Refresh ingredients list
        await fetchIngredients();
    } catch (error) {
        console.error('Error adding ingredient:', error);
        alert('Failed to add ingredient: ' + error.message);
    }
});

// Function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

// Function to render ingredients
function renderIngredients(ingredients) {
    if (!ingredients || ingredients.length === 0) {
        ingredientsList.innerHTML = '<p class="no-data">No ingredients found</p>';
        return;
    }

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

    const ingredientsHtml = ingredients.map(ingredient => {
        // Handle database column naming which might use snake_case
        const name = ingredient.name;
        const category = ingredient.category;
        const quantity = ingredient.quantity;
        const unit = ingredient.unit || '';
        const expiryDate = ingredient.expiry_date || ingredient.expiryDate;
        const brand = ingredient.brand || 'N/A';

        return `
        <div class="ingredient-card" data-name="${name}">
            <div class="ingredient-content">
                <div class="ingredient-field">
                    <span class="field-label">Name</span>
                    <span class="field-value">${name}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Category</span>
                    <span class="field-value ${category ? category.toLowerCase().replace(/\s+/g, '-') : ''}">${category || 'N/A'}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Quantity</span>
                    <span class="field-value">
                        <div class="quantity-controls">
                            <button class="quantity-btn decrease-qty" data-name="${name}">-</button>
                            <span>${quantity} ${unit}</span>
                            <button class="quantity-btn increase-qty" data-name="${name}">+</button>
                        </div>
                    </span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Expiry Date</span>
                    <span class="field-value">${formatDate(expiryDate)}</span>
                </div>
                <div class="ingredient-field">
                    <span class="field-label">Brand</span>
                    <span class="field-value">${brand}</span>
                </div>
            </div>
            <div class="ingredient-actions">
                <button class="delete-button" data-name="${name}">
                    <span class="material-icons">delete</span> Remove
                </button>
            </div>
        </div>
        `;
    }).join('');

    ingredientsList.innerHTML = headerHtml + ingredientsHtml;
    
    // Add event listeners for the buttons
    attachIngredientEventListeners();
}

// Function to attach event listeners to ingredient cards
function attachIngredientEventListeners() {
    // Increase quantity buttons
    document.querySelectorAll('.increase-qty').forEach(button => {
        button.addEventListener('click', async () => {
            const name = button.getAttribute('data-name');
            const ingredient = currentIngredients.find(ing => ing.name === name);
            if (ingredient) {
                // Parse current quantity as integer and add 1
                const newQuantity = parseInt(ingredient.quantity) + 1;
                try {
                    await updateIngredient(name, { quantity: newQuantity });
                    // Don't update local state here, let the fetchIngredients do it
                    await fetchIngredients();
                } catch (error) {
                    console.error('Error updating quantity:', error);
                    alert('Failed to update quantity: ' + error.message);
                }
            }
        });
    });
    
    // Decrease quantity buttons
    document.querySelectorAll('.decrease-qty').forEach(button => {
        button.addEventListener('click', async () => {
            const name = button.getAttribute('data-name');
            const ingredient = currentIngredients.find(ing => ing.name === name);
            
            if (ingredient) {
                // Parse current quantity as integer
                const currentQty = parseInt(ingredient.quantity);
                
                if (currentQty > 1) {
                    // Decrement quantity if it's greater than 1
                    const newQuantity = currentQty - 1;
                    try {
                        await updateIngredient(name, { quantity: newQuantity });
                        await fetchIngredients();
                    } catch (error) {
                        console.error('Error updating quantity:', error);
                        alert('Failed to update quantity: ' + error.message);
                    }
                } else if (currentQty === 1) {
                    // If quantity is exactly 1, ask for confirmation to delete
                    if (confirm(`The quantity is 1. Do you want to remove ${name} completely?`)) {
                        try {
                            await deleteIngredient(name);
                            await fetchIngredients();
                        } catch (error) {
                            console.error('Error deleting ingredient:', error);
                            alert('Failed to delete ingredient: ' + error.message);
                        }
                    }
                }
            }
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', async () => {
            const name = button.getAttribute('data-name');
            if (confirm(`Are you sure you want to remove ${name}?`)) {
                try {
                    await deleteIngredient(name);
                    await fetchIngredients();
                } catch (error) {
                    console.error('Error deleting ingredient:', error);
                    alert('Failed to delete ingredient: ' + error.message);
                }
            }
        });
    });
}

// Function to render recipes
function renderRecipes(recipes) {
    if (!recipes || recipes.length === 0) {
        recipesList.innerHTML = '<p class="no-data">No recipes available yet</p>';
        return;
    }

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
    // Show loading indicator
    ingredientsList.innerHTML = '<div class="loading"></div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/ingredients`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched ingredients:', data);
        currentIngredients = data;
        renderIngredients(currentIngredients);
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        ingredientsList.innerHTML = '<p class="error">Failed to load ingredients: ' + error.message + '</p>';
    }
}

// Function to add a new ingredient
async function addIngredient(ingredient) {
    try {
        const response = await fetch(`${API_BASE_URL}/ingredients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ingredient)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error adding ingredient:', error);
        throw error;
    }
}

// Function to update an ingredient
async function updateIngredient(name, updates) {
    try {
        const response = await fetch(`${API_BASE_URL}/ingredients/${name}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error updating ingredient:', error);
        throw error;
    }
}

// Function to delete an ingredient
async function deleteIngredient(name) {
    try {
        const response = await fetch(`${API_BASE_URL}/ingredients/${name}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        throw error;
    }
}

// Function to fetch recipe recommendations
async function fetchRecipes() {
    // Show loading indicator
    recipesList.innerHTML = '<div class="loading"></div>';
    
    // This is commented out for now since the recipes endpoint doesn't seem to exist in the backend
    // Will display placeholder content instead
    setTimeout(() => {
        recipesList.innerHTML = '<p class="info">Recipe functionality will be available soon!</p>';
    }, 500); // Short timeout to show the loading indicator
    
    /*
    try {
        const response = await fetch(`${API_BASE_URL}/recipes`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        currentRecipes = data;
        renderRecipes(currentRecipes);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        recipesList.innerHTML = '<p class="error">Failed to load recipes: ' + error.message + '</p>';
    }
    */
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    fetchIngredients();
    fetchRecipes();
});