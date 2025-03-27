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
    
    if (false) { //imageFormat === 'RGB565' <-- original code
      // Get image dimensions from headers
      const width = parseInt(req.headers['x-image-width'] || '640');
      const height = parseInt(req.headers['x-image-height'] || '480');
      
      console.log(`Received image request with format: ${imageFormat}, dimensions: ${width}x${height}`);
      
      // Check if we've received binary data
      if (!Buffer.isBuffer(req.body)) {
        console.error('Expected buffer but received:', typeof req.body);
        return res.status(400).json({ message: 'Invalid image data: not a buffer' });
      }
      
      const imageBuffer = req.body;
      console.log(`Received RGB565 image data: ${imageBuffer.length} bytes`);
      
      // Verify expected data size
      const expectedSize = width * height * 2; // RGB565 uses 2 bytes per pixel
      if (imageBuffer.length !== expectedSize) {
        console.warn(`Warning: Image data size mismatch. Received: ${imageBuffer.length}, Expected: ${expectedSize}`);
      }
      
      // Save raw data first for debugging
      const rawImagePath = path.join(TEMP_DIR, `${imageId}.raw`);
      fs.writeFileSync(rawImagePath, imageBuffer);
      console.log(`Raw data saved to ${rawImagePath}`);
      
      try {
        // Convert RGB565 to JPEG
        imagePath = await convertRGB565ToJPEG(rawImagePath, width, height, imageId);
        
        // Create timestamp for filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filenameBase = `esp32_image_${timestamp}`;
        const savedImagePath = path.join(SAVED_IMAGES_DIR, `${filenameBase}.jpg`);
        
        // Save metadata
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
        
        // Save the converted image as a permanent copy
        fs.copyFileSync(imagePath, savedImagePath);
        console.log(`Permanent copy saved to: ${savedImagePath}`);
        
        // Clean up the raw file
        fs.unlinkSync(rawImagePath);
      } catch (convError) {
        console.error('Error converting RGB565 to JPEG:', convError);
        
        // Return a meaningful error for debugging
        return res.status(500).json({
          message: 'Error converting image format',
          error: convError.message
        });
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

    // Process the image with AI or just return success
    try {
      // Optional AI processing - comment out if not needed
      // const result = await recognizeIngredientWithAI(imagePath);
      
      // Simple success response with image details
      const result = {
        success: true,
        message: 'Image received and processed successfully',
        imageId: imageId,
        timestamp: new Date().toISOString()
      };
      
      // Clean up - remove only the temporary image file
      try {
        fs.unlinkSync(imagePath);
      } catch (deleteErr) {
        console.error(`Failed to delete temp file: ${deleteErr.message}`);
      }
      
      // Send the results back to the client
      res.status(200).json(result);
    } catch (error) {
      console.error('Error processing image:', error);
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
 * Convert RGB565 data to a JPEG image using Jimp
 */
// const convertRGB565ToJPEG = async (rawImagePath, width, height, imageId) => {
//   return new Promise((resolve, reject) => {
//     try {
//       // Read the raw RGB565 data
//       const rgb565Buffer = fs.readFileSync(rawImagePath);
//       console.log(`RGB565 buffer length: ${rgb565Buffer.length}, expected: ${width * height * 2}`);
      
//       // Create a new Jimp image
//       new Jimp(width, height, (err, image) => {
//         if (err) return reject(err);
        
//         // Calculate how many pixels we can process
//         const pixelCount = Math.min(Math.floor(rgb565Buffer.length / 2), width * height);
//         console.log(`Processing ${pixelCount} pixels from a ${width}x${height} image`);
        
//         // Convert RGB565 to RGB888 for each pixel
//         for (let i = 0; i < pixelCount; i++) {
//           const x = i % width;
//           const y = Math.floor(i / width);
//           const pos = i * 2;
          
//           // RGB565 format: RRRRRGGG GGGBBBBB (little-endian)
//           const value = (rgb565Buffer[pos] | (rgb565Buffer[pos + 1] << 8));
          
//           // Extract RGB components (5 bits R, 6 bits G, 5 bits B)
//           const r = ((value >> 11) & 0x1F) << 3; // 5 bits to 8 bits
//           const g = ((value >> 5) & 0x3F) << 2;  // 6 bits to 8 bits
//           const b = (value & 0x1F) << 3;         // 5 bits to 8 bits
          
//           // Set pixel in the Jimp image
//           const pixelColor = Jimp.rgbaToInt(r, g, b, 255);
//           image.setPixelColor(pixelColor, x, y);
//         }
        
//         // Save as JPEG
//         const jpegPath = path.join(TEMP_DIR, `${imageId}.jpg`);
//         image.write(jpegPath, (err) => {
//           if (err) return reject(err);
//           console.log(`Converted RGB565 to JPEG: ${jpegPath}`);
//           resolve(jpegPath);
//         });
//       });
//     } catch (error) {
//       reject(error);
//     }
//   });
// };

// Only define the functions we'll actually use
const createFallbackImage = async (imageId) => {
  return new Promise((resolve, reject) => {
    const image = new Jimp(640, 480, 0xFFFF0000, (err, image) => {
      if (err) return reject(err);
      
      // Add some text
      Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).then(font => {
        image.print(font, 10, 10, 'Fallback Image - ESP32 Image Processing Failed');
        image.print(font, 10, 30, `Generated: ${new Date().toLocaleString()}`);
        image.print(font, 10, 50, `ID: ${imageId}`);
        
        const outputPath = path.join(TEMP_DIR, `${imageId}.jpg`);
        image.write(outputPath, (err) => {
          if (err) return reject(err);
          resolve(outputPath);
        });
      }).catch(reject);
    });
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

// Export all the functions we'll use
module.exports = {
  processImage,
  //convertRGB565ToJPEG,
  createFallbackImage
}; 