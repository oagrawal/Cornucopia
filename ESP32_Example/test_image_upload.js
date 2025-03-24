/**
 * Test script to simulate an ESP32-CAM uploading an image to the server
 * 
 * Usage:
 * 1. Place a test image (test.jpg) in the same directory
 * 2. Run: node test_image_upload.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const SERVER_URL = 'http://localhost:3000/api/image-processing';
const TEST_IMAGE_PATH = path.join(__dirname, 'test.jpg');

// Check if the test image exists
if (!fs.existsSync(TEST_IMAGE_PATH)) {
  console.error(`Error: Test image not found at ${TEST_IMAGE_PATH}`);
  console.error('Please place a test image named "test.jpg" in this directory.');
  process.exit(1);
}

/**
 * Send the test image to the server
 */
async function testImageUpload() {
  try {
    console.log('Reading test image...');
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    
    console.log(`Sending ${imageBuffer.length} bytes to ${SERVER_URL}...`);
    
    const response = await axios.post(SERVER_URL, imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
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
testImageUpload(); 