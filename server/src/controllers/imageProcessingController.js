const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const Jimp = require('jimp');
require('dotenv').config();

// Temporary directory for saving incoming images
const TEMP_DIR = path.join(__dirname, '..', 'temp');
// Permanent directory for saving image copies
const SAVED_IMAGES_DIR = path.join(__dirname, '..', '..', 'saved_images');

// Create directories if they don't exist
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`Created temp directory: ${TEMP_DIR}`);
  } catch (err) {
    console.error(`Failed to create temp directory: ${err.message}`);
  }
}

if (!fs.existsSync(SAVED_IMAGES_DIR)) {
  try {
    fs.mkdirSync(SAVED_IMAGES_DIR, { recursive: true });
    console.log(`Created saved images directory: ${SAVED_IMAGES_DIR}`);
  } catch (err) {
    console.error(`Failed to create saved images directory: ${err.message}`);
  }
}

/**
 * Process an uploaded image with AI to detect ingredients
 */
const processImage = async (req, res) => {
  try {
    // Generate a unique ID for this request
    const imageId = uuidv4();
    let imagePath;
    
    // Check if the image is in RGB565 format (from ESP32-CAM)
    const imageFormat = req.headers['x-image-format'];
    
    if (imageFormat === 'RGB565') {
      // Get image dimensions from headers
      const width = parseInt(req.headers['x-image-width'] || '640');
      const height = parseInt(req.headers['x-image-height'] || '480');
      
      // Ensure we have a proper Buffer
      let imageBuffer;
      if (Buffer.isBuffer(req.body)) {
        imageBuffer = req.body;
      } else if (req.body instanceof ArrayBuffer || ArrayBuffer.isView(req.body)) {
        // Convert ArrayBuffer or TypedArray to Buffer
        imageBuffer = Buffer.from(req.body);
      } else if (typeof req.body === 'object') {
        // Handle case where req.body might be a complex object
        console.log('Received object data, attempting to convert...');
        try {
          // Convert to string and then to buffer as a fallback
          imageBuffer = Buffer.from(JSON.stringify(req.body));
        } catch (e) {
          console.error('Failed to convert object to buffer:', e);
          return res.status(400).json({ message: 'Invalid image data format' });
        }
      } else {
        console.error('Unexpected body type:', typeof req.body);
        return res.status(400).json({ message: 'Invalid image data format' });
      }
      
      console.log(`Received RGB565 image: ${width}x${height}, size: ${imageBuffer.length} bytes`);
      
      // Save raw data first
      const rawImagePath = path.join(TEMP_DIR, `${imageId}.raw`);
      fs.writeFileSync(rawImagePath, imageBuffer);
      console.log(`Raw data saved to ${rawImagePath}`);
      
      // Analyze first few bytes for debug purposes
      if (imageBuffer.length >= 10) {
        const firstBytes = Array.from(imageBuffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`First 10 bytes: ${firstBytes}`);
      }
      
      // Convert RGB565 to JPEG
      try {
        imagePath = await convertRGB565ToJPEG(rawImagePath, width, height, imageId);
        
        // Save a permanent copy of the converted image
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filenameBase = `esp32_image_${timestamp}`;
        const savedImagePath = path.join(SAVED_IMAGES_DIR, `${filenameBase}.jpg`);
        
        // Create metadata file first (so we have info even if image copy fails)
        try {
          const metadataPath = path.join(SAVED_IMAGES_DIR, `${filenameBase}_info.txt`);
          const metadata = `Image captured: ${new Date().toString()}\n` +
                         `Resolution: ${width}x${height}\n` +
                         `Original format: RGB565\n` +
                         `Original size: ${imageBuffer.length} bytes\n` +
                         `Converted to: JPEG\n` +
                         `Temporary path: ${imagePath}\n` +
                         `Saved path: ${savedImagePath}\n`;
          
          fs.writeFileSync(metadataPath, metadata);
          console.log(`Saved metadata to: ${metadataPath}`);
        } catch (metaErr) {
          console.error(`Failed to write metadata file: ${metaErr.message}`);
        }
        
        // Copy the image file
        try {
          fs.copyFileSync(imagePath, savedImagePath);
          console.log(`Permanent copy saved to: ${savedImagePath}`);
        } catch (copyErr) {
          console.error(`Failed to save permanent copy: ${copyErr.message}`);
        }
        
        // Delete raw file since we don't need it anymore
        try {
          fs.unlinkSync(rawImagePath);
        } catch (deleteErr) {
          console.error(`Failed to delete raw file: ${deleteErr.message}`);
        }
      } catch (convError) {
        console.error('Error converting RGB565 to JPEG:', convError);
        
        try {
          // Fallback: Create a generic test image for AI processing
          console.log('Attempting to create fallback image...');
          imagePath = await createFallbackImage(imageId);
          
          // Save a permanent copy of the fallback image
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const savedImagePath = path.join(SAVED_IMAGES_DIR, `esp32_fallback_${timestamp}.jpg`);
          fs.copyFileSync(imagePath, savedImagePath);
          console.log(`Permanent fallback copy saved to: ${savedImagePath}`);
          
          // Delete raw file
          try {
            fs.unlinkSync(rawImagePath);
          } catch (deleteErr) {
            console.error(`Failed to delete raw file: ${deleteErr.message}`);
          }
        } catch (fallbackError) {
          console.error('Error creating fallback image:', fallbackError);
          return res.status(500).json({
            message: 'Error converting image format',
            error: convError.message
          });
        }
      }
    } else {
      // Standard JPEG image handling
      imagePath = path.join(TEMP_DIR, `${imageId}.jpg`);
      fs.writeFileSync(imagePath, req.body);
      
      // Save a permanent copy of the JPEG image
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savedImagePath = path.join(SAVED_IMAGES_DIR, `jpeg_image_${timestamp}.jpg`);
      fs.copyFileSync(imagePath, savedImagePath);
      console.log(`Permanent copy saved to: ${savedImagePath}`);
    }
    
    console.log(`Image saved to ${imagePath}`);

    // Process the image with AI
    try {
      const result = await recognizeIngredientWithAI(imagePath);
      
      // Clean up - remove only the temporary image file
      try {
        fs.unlinkSync(imagePath);
      } catch (deleteErr) {
        console.error(`Failed to delete temp file: ${deleteErr.message}`);
      }
      
      // Send the results back to the client
      res.status(200).json(result);
    } catch (error) {
      console.error('Error processing image with AI:', error);
      res.status(500).json({ 
        message: 'Error processing image',
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error processing image upload:', error);
    res.status(500).json({ 
      message: 'Error processing image upload',
      error: error.message 
    });
  }
};

/**
 * Use a simpler approach to convert RGB565 data to a JPEG image
 * This function tries multiple interpretations of the data format
 */
const convertRGB565ToJPEG = async (rawImagePath, width, height, imageId) => {
  return new Promise((resolve, reject) => {
    try {
      // Read the raw RGB565 data
      const rgb565Buffer = fs.readFileSync(rawImagePath);
      console.log(`RGB565 buffer length: ${rgb565Buffer.length}, expected: ${width * height * 2}`);
      
      // Create a new Jimp image
      new Jimp(width, height, (err, image) => {
        if (err) return reject(err);
        
        // Calculate how many pixels we can process
        const pixelCount = Math.min(Math.floor(rgb565Buffer.length / 2), width * height);
        console.log(`Processing ${pixelCount} pixels from a ${width}x${height} image`);
        
        // Try different RGB565 conversion approaches
        // ESP32-CAM often uses a specific layout for RGB565 that needs special handling
        
        // First analyze the image data
        let totalPixelValue = 0;
        let nonZeroPixels = 0;
        for (let i = 0; i < Math.min(100, pixelCount); i++) {
          const pos = i * 2;
          if (pos + 1 < rgb565Buffer.length) {
            const high = rgb565Buffer[pos+1];
            const low = rgb565Buffer[pos];
            if (high !== 0 || low !== 0) {
              nonZeroPixels++;
              totalPixelValue += high + low;
            }
          }
        }
        
        console.log(`Data analysis: ${nonZeroPixels}/100 non-zero pixels, avg value: ${nonZeroPixels ? (totalPixelValue / nonZeroPixels).toFixed(2) : 0}`);
        
        // Option 1: Standard RGB565 format with proper scaling to RGB888
        const useStandardConversion = true;
        
        // Use enhanced conversion for better color accuracy
        for (let i = 0; i < pixelCount; i++) {
          const x = i % width;
          const y = Math.floor(i / width);
          const pos = i * 2;
          
          // Standard format: RRRRRGGG GGGBBBBB (little-endian)
          // Read as little-endian (lower byte first)
          const high = rgb565Buffer[pos+1]; // Upper byte
          const low = rgb565Buffer[pos];    // Lower byte
          
          if (useStandardConversion) {
            // Enhanced conversion with better scaling from 5/6 bits to 8 bits
            // Use bit shifting for most accurate conversion from RGB565 to RGB888
            const r = ((high & 0xF8) >> 3) * 255 / 31;  // 5 bits for red (0-31)
            const g = (((high & 0x07) << 3) | ((low & 0xE0) >> 5)) * 255 / 63; // 6 bits for green (0-63) 
            const b = (low & 0x1F) * 255 / 31; // 5 bits for blue (0-31)
            
            try {
              // Clamp values to valid range and round to integers
              const red = Math.min(255, Math.max(0, Math.round(r)));
              const green = Math.min(255, Math.max(0, Math.round(g)));
              const blue = Math.min(255, Math.max(0, Math.round(b)));
              
              image.setPixelColor(Jimp.rgbaToInt(red, green, blue, 255), x, y);
            } catch (pixelErr) {
              // Use a neutral gray if there's an error
              image.setPixelColor(Jimp.rgbaToInt(128, 128, 128, 255), x, y);
            }
          }
        }
        
        // Basic image adjustments for better visibility
        image.normalize() // Normalize colors for better contrast
             .brightness(0.1) // Slightly increase brightness
             .contrast(0.1);  // Slightly increase contrast
        
        // Save as JPEG with high quality
        const jpegPath = path.join(TEMP_DIR, `${imageId}.jpg`);
        image.quality(95).write(jpegPath, (err) => {
          if (err) return reject(err);
          console.log(`Successfully converted RGB565 to JPEG: ${jpegPath}`);
          resolve(jpegPath);
        });
      });
    } catch (error) {
      console.error('Error in RGB565 conversion:', error);
      reject(error);
    }
  });
};

/**
 * Create a simple fallback image for testing when conversion fails
 */
const createFallbackImage = async (imageId) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a small test image
      new Jimp(320, 240, 0xffffffff, (err, image) => {
        if (err) return reject(err);
        
        // Draw a simple colored rectangle
        for (let y = 40; y < 200; y++) {
          for (let x = 60; x < 260; x++) {
            // Make a gradient pattern
            const r = Math.floor(255 * (x - 60) / 200);
            const g = Math.floor(255 * (y - 40) / 160);
            const b = 100;
            image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
          }
        }
        
        // Add some text (as a colored rectangle pattern)
        const jpegPath = path.join(TEMP_DIR, `${imageId}.jpg`);
        image.quality(90).write(jpegPath, (err) => {
          if (err) return reject(err);
          console.log(`Created fallback image: ${jpegPath}`);
          resolve(jpegPath);
        });
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Use a multimodal AI model to recognize ingredients in the image
 * For this example, we'll use a mock implementation that simulates
 * calling an AI service
 */
const recognizeIngredientWithAI = async (imagePath) => {
  // For a real implementation, you would:
  // 1. Call an AI service API (like OpenAI's GPT-4 Vision, Google Cloud Vision, etc.)
  // 2. Process the results
  
  // For this mock example, we'll simulate an AI response
  console.log(`Processing image with AI: ${imagePath}`);
  
  // Read the image file
  const imageBuffer = fs.readFileSync(imagePath);
  
  // In a real implementation, you would send this image to an AI service
  // For example, with OpenAI's API:
  
  // const result = await callAIService(imagePath);
  const result = simulateAIResponse(imagePath);
  
  console.log('AI Processing result:', result);
  return result;
};

/**
 * This function simulates a call to an AI service API
 * In a real application, you would replace this with an actual API call
 */
const simulateAIResponse = (imagePath) => {
  // Simulate a delay like a real API call would have
  // In a real implementation, this would be an await axios.post() or similar
  
  // Mock response - in reality, this would come from the AI service
  const mockResponses = [
    {
      name: 'Apple',
      category: 'Produce',
      quantity: 1,
      expiryDate: '2024-04-10',
      brand: null
    },
    {
      name: 'Milk',
      category: 'Dairy',
      quantity: 1,
      expiryDate: '2024-03-25',
      brand: 'Organic Valley'
    },
    {
      name: 'Bread',
      category: 'Bakery',
      quantity: 1,
      expiryDate: '2024-03-22',
      brand: 'Wonder'
    }
  ];
  
  // Return a random mock response
  const randomIndex = Math.floor(Math.random() * mockResponses.length);
  return mockResponses[randomIndex];
};

/**
 * For actual implementation, replace this with a real AI service call
 * Example with OpenAI's GPT-4 Vision API:
 */
/*
const callAIService = async (imagePath) => {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identify the ingredient in this image. Return a JSON object with the following fields: name, category, quantity, expiryDate (if visible, otherwise null), and brand (if visible, otherwise null)."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    // Parse the response to get structured data
    const aiResponse = response.data.choices[0].message.content;
    try {
      // The AI response might be formatted as JSON or as text describing JSON
      // Try to extract and parse the JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
      const result = JSON.parse(jsonStr);
      return result;
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Fallback if we can't parse the JSON
      return {
        name: 'Unknown',
        category: 'Unknown',
        quantity: 0,
        expiryDate: null,
        brand: null,
        rawResponse: aiResponse
      };
    }
  } catch (error) {
    console.error('Error calling AI service:', error);
    throw error;
  }
};
*/

module.exports = {
  processImage
}; 