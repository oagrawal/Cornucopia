const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const Jimp = require('jimp');
require('dotenv').config();

// Temporary directory for saving incoming images
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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
      const width = parseInt(req.headers['x-image-width'] || '800');
      const height = parseInt(req.headers['x-image-height'] || '600');
      
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
        // Delete the raw file after conversion
        fs.unlinkSync(rawImagePath);
      } catch (convError) {
        console.error('Error converting RGB565 to JPEG:', convError);
        
        try {
          // Fallback: Create a generic test image for AI processing
          console.log('Attempting to create fallback image...');
          imagePath = await createFallbackImage(imageId);
          fs.unlinkSync(rawImagePath);
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
    }
    
    console.log(`Image saved to ${imagePath}`);

    // Process the image with AI
    try {
      const result = await recognizeIngredientWithAI(imagePath);
      
      // Clean up - remove the temporary image file
      fs.unlinkSync(imagePath);
      
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
        console.log(`Processing ${pixelCount} pixels`);
        
        // Try to detect if we need to swap bytes for endianness
        let needsByteSwap = false;
        
        // Sample the first few pixels to see if they make sense
        // Reasonable RGB values should have some variation and not be all black or white
        let testPixels = [];
        for (let i = 0; i < Math.min(10, pixelCount); i++) {
          const pos = i * 2;
          // Try little-endian (standard for most systems)
          const pixelLE = (rgb565Buffer[pos+1] << 8) | rgb565Buffer[pos];
          // Try big-endian
          const pixelBE = (rgb565Buffer[pos] << 8) | rgb565Buffer[pos+1];
          
          testPixels.push({
            le: {
              r: ((pixelLE >> 11) & 0x1F),
              g: ((pixelLE >> 5) & 0x3F),
              b: (pixelLE & 0x1F)
            },
            be: {
              r: ((pixelBE >> 11) & 0x1F),
              g: ((pixelBE >> 5) & 0x3F),
              b: (pixelBE & 0x1F)
            }
          });
        }
        
        // Log some sample pixels for debugging
        console.log("Sample pixels (first few):", 
          testPixels.slice(0, 3).map(p => 
            `LE: R${p.le.r},G${p.le.g},B${p.le.b} | BE: R${p.be.r},G${p.be.g},B${p.be.b}`
          )
        );
        
        // Try to determine if we need to swap bytes by checking which format has more variation
        // (real images typically have some color variation)
        let leVariation = 0, beVariation = 0;
        for (let i = 1; i < testPixels.length; i++) {
          leVariation += Math.abs(testPixels[i].le.r - testPixels[i-1].le.r) +
                        Math.abs(testPixels[i].le.g - testPixels[i-1].le.g) +
                        Math.abs(testPixels[i].le.b - testPixels[i-1].le.b);
          
          beVariation += Math.abs(testPixels[i].be.r - testPixels[i-1].be.r) +
                        Math.abs(testPixels[i].be.g - testPixels[i-1].be.g) +
                        Math.abs(testPixels[i].be.b - testPixels[i-1].be.b);
        }
        
        // If big-endian variation is higher, use that format
        needsByteSwap = beVariation > leVariation;
        console.log(`Detected endianness: ${needsByteSwap ? 'Big-endian' : 'Little-endian'} (LE var: ${leVariation}, BE var: ${beVariation})`);
        
        // Process all pixels with the detected endianness
        for (let i = 0; i < pixelCount; i++) {
          const x = i % width;
          const y = Math.floor(i / width);
          const pos = i * 2;
          
          let pixel;
          if (needsByteSwap) {
            // Big-endian
            pixel = (rgb565Buffer[pos] << 8) | rgb565Buffer[pos+1];
          } else {
            // Little-endian
            pixel = (rgb565Buffer[pos+1] << 8) | rgb565Buffer[pos];
          }
          
          // Extract RGB components
          const r = ((pixel >> 11) & 0x1F) * 8;
          const g = ((pixel >> 5) & 0x3F) * 4;
          const b = (pixel & 0x1F) * 8;
          
          // Set pixel safely
          try {
            image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
          } catch (pixelErr) {
            // If there's an error with a specific pixel, use a default color
            image.setPixelColor(Jimp.rgbaToInt(100, 100, 100, 255), x, y);
          }
        }
        
        // Save as JPEG
        const jpegPath = path.join(TEMP_DIR, `${imageId}.jpg`);
        image.quality(85).write(jpegPath, (err) => {
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