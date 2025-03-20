const express = require('express');
const cors = require('cors');
const ingredientRoutes = require('./routes/ingredientRoutes');
const imageProcessingRoutes = require('./routes/imageProcessingRoutes');
require('dotenv').config();

// Import database connection
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*', // Allow requests from any origin for development
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow all methods we need
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Image-Format', 'X-Image-Width', 'X-Image-Height']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['image/jpeg', 'application/octet-stream'], limit: '50mb' }));

// Routes
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/image-processing', imageProcessingRoutes);

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 