const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ingredientRoutes = require('./routes/ingredientRoutes');
const imageProcessingRoutes = require('./routes/imageProcessingRoutes');
require('dotenv').config();

// Import database connection
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Image-Format', 'X-Image-Width', 'X-Image-Height']
}));

// Handle JSON and raw image data
app.use(express.json());
app.use(express.raw({ type: ['image/jpeg'], limit: '50mb' }));

// Serve static files from the saved_images directory
app.use('/images', express.static(path.join(__dirname, '..', 'saved_images')));

// Add a simple HTML page to view saved images
app.get('/view-images', (req, res) => {
    const savedImagesDir = path.join(__dirname, '..', 'saved_images');
    
    // Get list of image files
    fs.readdir(savedImagesDir, (err, files) => {
        if (err) {
            console.error('Error reading saved_images directory:', err);
            return res.status(500).send('Error loading images');
        }
        
        // Filter for image files
        const imageFiles = files.filter(file => 
            file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')
        );
        
        // Filter for metadata files
        const metadataFiles = files.filter(file => file.endsWith('_info.txt'));
        
        // Sort by newest first
        imageFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(savedImagesDir, a));
            const statB = fs.statSync(path.join(savedImagesDir, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
        });
        
        // Generate HTML with image list
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>ESP32-CAM Saved Images</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
                h1, h2 { color: #333; }
                .controls { margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                .controls button { padding: 8px 16px; margin-right: 10px; }
                .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 25px; }
                .image-item { border: 1px solid #ddd; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .image-item img { width: 100%; height: auto; border-radius: 5px; object-fit: contain; }
                .image-item p { margin: 10px 0 0; font-size: 14px; color: #666; }
                .metadata { background: #f8f8f8; padding: 10px; border-left: 3px solid #ddd; margin-top: 15px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto; max-height: 200px; overflow-y: auto; }
                .image-info { margin-top: 10px; }
                .no-images { padding: 50px; background: #f8f8f8; text-align: center; border-radius: 5px; }
                .debug-info { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; }
                .debug-item { background: #f0f0f0; padding: 10px; margin-bottom: 10px; border-radius: 3px; }
                .toggle-button { cursor: pointer; color: #0066cc; }
            </style>
        </head>
        <body>
            <h1>ESP32-CAM Saved Images</h1>
            
            <div class="controls">
                <button onclick="window.location.reload()">Refresh Page</button>
                <span id="autoRefreshStatus">Auto-refresh is ON</span>
                <button onclick="toggleAutoRefresh()">Toggle Auto-refresh</button>
                <span style="margin-left: 20px;">Total Images: ${imageFiles.length}</span>
            </div>
            
            <div class="server-info">
                <p>Server time: ${new Date().toLocaleString()}</p>
                <p>Images directory: ${savedImagesDir}</p>
            </div>
        `;
        
        if (imageFiles.length === 0) {
            html += `<div class="no-images">No images found. Capture some images with your ESP32-CAM first.</div>`;
        } else {
            html += `<div class="image-grid">`;
            
            for (const file of imageFiles) {
                const stats = fs.statSync(path.join(savedImagesDir, file));
                const created = stats.mtime.toLocaleString();
                const fileSizeKB = Math.round(stats.size / 1024);
                
                // Check if we have metadata for this image
                const baseFilename = file.replace(/\.[^/.]+$/, ""); // Remove extension
                const metadataFile = `${baseFilename}_info.txt`;
                let metadata = null;
                
                if (metadataFiles.includes(metadataFile)) {
                    try {
                        metadata = fs.readFileSync(path.join(savedImagesDir, metadataFile), 'utf8');
                    } catch (err) {
                        console.error(`Error reading metadata for ${file}: ${err.message}`);
                    }
                }
                
                html += `
                <div class="image-item">
                    <img src="/images/${file}" alt="${file}" />
                    <div class="image-info">
                        <p><strong>Filename:</strong> ${file}</p>
                        <p><strong>Created:</strong> ${created}</p>
                        <p><strong>Size:</strong> ${fileSizeKB} KB</p>
                    </div>
                    ${metadata ? 
                        `<div class="toggle-button" onclick="toggleMetadata('metadata-${baseFilename}')">Show/Hide Metadata</div>
                        <div class="metadata" id="metadata-${baseFilename}" style="display: none;">${metadata}</div>` 
                        : ''}
                </div>
                `;
            }
            
            html += `</div>`;
        }
        
        // Add debug information
        html += `
        <div class="debug-info">
            <h2>Debug Information</h2>
            <div class="toggle-button" onclick="toggleMetadata('debug-section')">Show/Hide Debug Info</div>
            <div id="debug-section" style="display: none;">
                <div class="debug-item">
                    <p><strong>Server Directory Structure:</strong></p>
                    <pre>${JSON.stringify({
                        'server_root': fs.readdirSync(path.join(__dirname, '..')).sort(),
                        'src_directory': fs.readdirSync(__dirname).sort(),
                        'temp_directory': fs.existsSync(path.join(__dirname, 'temp')) ? 
                            fs.readdirSync(path.join(__dirname, 'temp')).sort() : 'Directory not found',
                        'saved_images': files.sort()
                    }, null, 2)}</pre>
                </div>
                
                <div class="debug-item">
                    <p><strong>Server Environment:</strong></p>
                    <pre>NODE_ENV: ${process.env.NODE_ENV || 'not set'}
Port: ${PORT}
Platform: ${process.platform}
Node Version: ${process.version}</pre>
                </div>
            </div>
        </div>
        
        <script>
            let autoRefreshEnabled = true;
            let refreshTimer = setTimeout(() => { 
                if (autoRefreshEnabled) location.reload(); 
            }, 10000);
            
            function toggleAutoRefresh() {
                autoRefreshEnabled = !autoRefreshEnabled;
                document.getElementById('autoRefreshStatus').innerText = 
                    autoRefreshEnabled ? 'Auto-refresh is ON' : 'Auto-refresh is OFF';
                
                if (autoRefreshEnabled) {
                    refreshTimer = setTimeout(() => { location.reload(); }, 10000);
                } else {
                    clearTimeout(refreshTimer);
                }
            }
            
            function toggleMetadata(id) {
                const el = document.getElementById(id);
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        </script>
        </body>
        </html>
        `;
        
        res.send(html);
    });
});

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
    console.log(`View saved images at: http://localhost:${PORT}/view-images`);
}); 