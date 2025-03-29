const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const Jimp = require('jimp');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require('../config/db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
      const result = await recognizeIngredientWithAI(imagePath);
      
      // Simple success response with image details
      // const result = {
      //   success: true,
      //   message: 'Image received and processed successfully',
      //   imageId: imageId,
      //   timestamp: new Date().toISOString()
      // };
      
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
  
  const result = await callAIService(imagePath);
  // const result = simulateAIResponse(imagePath);
  
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


const callAIService = async (imagePath) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // const prompt = `Analyze this image and identify any food ingredients or products. If a food item is found, return a JSON object with these fields:
    // - name (string): the name of the food item
    // - category (string): one of [Cooking Essentials, Condiments and Beverages, Dairy, Sliced/Pre-Prepared Raw Ingredients, Produce, Pantry, Other]
    // - quantity (number): estimated quantity, default to 1 if unclear
    // - expiry_date (string in YYYY-MM-DD format or null): if visible in image
    // - brand (string or null): if visible in image
    // - is_food (boolean): true if this is a food item, false otherwise

    // If no food item is found, return { "is_food": false, "description": "description of what you see" }`;

    const prompt = `Analyze this image and identify any one food ingredients or products. If a food item is found, return a JSON object with these fields:
    - name (string or null): the name of the food item following specific naming conventions:
      * For branded products (excluding condiments/beverages), use generic name
      * For produce, identify specific types when possible (e.g., "Roma Tomatoes")
      * For condiments/beverages, use brand name only if distinctly associated
      * For sliced/prepared ingredients, specify preparation (e.g., "Sliced Mushrooms")
      * For unidentifiable items, use "Unknown Item"
    
    - category (string or null): one of [Fresh Produce, Meat and Seafood, Dairy and Eggs, Condiments and Sauces, Beverages, Pre-Packaged Meals and Snacks, Medicinal/Specialty, Fermented/Pickled, Grains/Baked Goods, Miscellaneous/Unknown]
    
    - quantity (number): descriptive quantity based on item type:
      * For produce: countable items, bunched items, or packaged amounts
      * For meat/seafood: pieces, weight, or package quantity
      * For dairy/eggs: item count, carton size, or volume
      * For condiments/sauces: volume, jar count, or packet count
      * For beverages: count and volume
      * For other categories: appropriate unit based on presentation
    
    - expiry_date (string in YYYY-MM-DD format or null): the expiry date of the product in YYYY-MM-DD format
      * Based on visible dates or typical shelf life for the product type
      * Return "null" when expiry cannot be determined
    
    - brand (string or null): visible brand name when applicable per naming guidelines
    
    - is_food (boolean): true if this is a food item, false otherwise

    If no food item is found, return { "is_food": false, "description": "description of what you see" }`;


    const imagePart = {
      inlineData: {
        data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
        mimeType: "image/jpeg"
      },
    };

    const generatedContent = await model.generateContent([prompt, imagePart]);
    const response = generatedContent.response.text();
    
    try {
      // Try to parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const result = JSON.parse(jsonStr);

      // If it's a food item, add it to the database
      if (result.is_food) {
        try {
          // Prepare the ingredient data
          const ingredientData = {
            name: result.name,
            category: result.category,
            quantity: result.quantity || 1,
            expiry_date: result.expiry_date || null,
            brand: result.brand || null
          };

          // Insert into database
          const dbResult = await db.query(
            `INSERT INTO ingredients (name, category, quantity, expiry_date, brand) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [ingredientData.name, ingredientData.category, ingredientData.quantity, 
             ingredientData.expiry_date, ingredientData.brand]
          );

          // Return combined result
          return {
            ...result,
            database_operation: 'success',
            saved_ingredient: dbResult.rows[0]
          };
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          return {
            ...result,
            database_operation: 'failed',
            error: dbError.message
          };
        }
      } else {
        // If not a food item, just return the AI response
        return {
          is_food: false,
          description: result.description || 'Not a food item',
          raw_response: response
        };
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return {
        is_food: false,
        error: 'Failed to parse AI response',
        raw_response: response
      };
    }
  } catch (error) {
    console.error('Error calling Gemini service:', error);
    throw error;
  }
};


// Export all the functions we'll use
module.exports = {
  processImage,
  createFallbackImage
}; 