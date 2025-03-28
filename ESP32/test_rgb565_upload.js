/**
 * Test script to simulate an ESP32-CAM uploading an RGB565 image to the server
 * 
 * Usage:
 * 1. Place a test image (test.jpg) in the same directory
 * 2. Run: node test_rgb565_upload.js
 * 
 * Note: This script simulates RGB565 data by creating random pixels.
 * In a real device, the actual RGB565 data would come from the camera.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const SERVER_URL = 'http://localhost:3000/api/image-processing';
const WIDTH = 800;
const HEIGHT = 600;

/**
 * Create sample RGB565 data for testing
 * RGB565 format: 16 bits per pixel, 2 bytes per pixel
 * Returns a Buffer with sample RGB565 data
 */
function createSampleRGB565Data(width, height) {
  // Create a buffer for the image (2 bytes per pixel)
  const bufferSize = width * height * 2;
  const buffer = Buffer.alloc(bufferSize);
  
  // Fill with sample pattern (checkerboard for testing)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = (y * width + x) * 2;
      
      // Generate some pattern to simulate an image
      // Checkerboard pattern with red, green, blue squares
      const isEvenX = Math.floor(x / 50) % 2 === 0;
      const isEvenY = Math.floor(y / 50) % 2 === 0;
      
      let r, g, b;
      if (isEvenX && isEvenY) {
        r = 31; g = 0; b = 0; // Red
      } else if (!isEvenX && isEvenY) {
        r = 0; g = 63; b = 0; // Green
      } else if (isEvenX && !isEvenY) {
        r = 0; g = 0; b = 31; // Blue
      } else {
        r = 31; g = 63; b = 31; // White
      }
      
      // Convert RGB to RGB565 (5 bits R, 6 bits G, 5 bits B)
      // Format: RRRRRGGGGGGBBBBB (16 bits)
      const rgb565 = ((r & 0x1F) << 11) | ((g & 0x3F) << 5) | (b & 0x1F);
      
      // Write the RGB565 value (little-endian)
      buffer[pos] = rgb565 & 0xFF;
      buffer[pos + 1] = (rgb565 >> 8) & 0xFF;
    }
  }
  
  return buffer;
}

/**
 * Send RGB565 test data to the server
 */
async function testRGB565Upload() {
  try {
    console.log('Creating sample RGB565 data...');
    const rgb565Buffer = createSampleRGB565Data(WIDTH, HEIGHT);
    
    console.log(`Sending ${rgb565Buffer.length} bytes to ${SERVER_URL}...`);
    
    const response = await axios.post(SERVER_URL, rgb565Buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Image-Format': 'RGB565',
        'X-Image-Width': WIDTH.toString(),
        'X-Image-Height': HEIGHT.toString(),
      },
    });
    
    console.log('Response received:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Display ingredient details
    if (response.data) {
      console.log('\nDetected Ingredient:');
      console.log(`- Name: ${response.data.name}`);
      console.log(`- Category: ${response.data.category}`);
      console.log(`- Quantity: ${response.data.quantity}`);
      console.log(`- Expiry Date: ${response.data.expiryDate || 'Not detected'}`);
      console.log(`- Brand: ${response.data.brand || 'Not detected'}`);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error uploading image:');
    
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server. Is the server running?');
    } else {
      // Something happened in setting up the request
      console.error('Error message:', error.message);
    }
  }
}

// Run the test
testRGB565Upload(); 