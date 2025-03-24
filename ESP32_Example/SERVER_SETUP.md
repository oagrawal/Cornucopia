# Server Setup for ESP32 Image Processing

This guide explains how to set up the server to receive and process images from an ESP32-CAM device.

## Overview

The system consists of:

1. ESP32-CAM device that captures images
2. Node.js server that receives images
3. AI processing to identify ingredients in the images

## Server Setup

### 1. Install New Dependencies

The server needs additional packages to handle image uploads and AI processing. Run:

```bash
cd server
npm install axios form-data uuid jimp
```

> **Note:** Jimp is required for processing RGB565 format images sent by the ESP32-CAM.

### 2. Set Up Environment Variables

If you want to use a real AI service like OpenAI, add your API key to the .env file:

```
# Add to server/.env
OPENAI_API_KEY=your_api_key_here
```

### 3. Create a Temporary Directory

The server saves uploaded images temporarily before processing them. Create this directory:

```bash
mkdir -p server/src/temp
```

### 4. Start the Server

```bash
cd server
npm run dev
```

The server should now be running on port 3000 (or your configured PORT).

## Image Format Support

The server now supports two image formats from the ESP32-CAM:

1. **JPEG Format**: Standard JPEG images
2. **RGB565 Format**: Raw RGB565 format (16-bit per pixel)

### ESP32-CAM RGB565 Configuration

The ESP32-CAM is configured to send images in RGB565 format with the following HTTP headers:

- `Content-Type: application/octet-stream`
- `X-Image-Format: RGB565`
- `X-Image-Width: 800` (or your configured width)
- `X-Image-Height: 600` (or your configured height)

The server will automatically detect these headers and convert the RGB565 data to JPEG for AI processing.

## Testing the Image Processing Endpoint

### Testing with JPEG Images

```bash
curl -X POST -H "Content-Type: image/jpeg" --data-binary "@path/to/test/image.jpg" http://localhost:3000/api/image-processing
```

### Testing with RGB565 Images

You can use the included test script:

```bash
cd ESP32_Example
npm install
node test_rgb565_upload.js
```

This script generates a sample RGB565 image and sends it to the server to verify proper handling.

You should receive a JSON response like:

```json
{
  "name": "Apple",
  "category": "Produce",
  "quantity": 1,
  "expiryDate": "2024-04-10",
  "brand": null
}
```

## Implementing Real AI Processing

The current implementation uses a mock AI response. To implement real AI processing:

1. Uncomment the `callAIService` function in `imageProcessingController.js`
2. Replace the line `const result = simulateAIResponse(imagePath);` with `const result = await callAIService(imagePath);`
3. Add your AI service API key to the .env file

## Next Steps

After confirming that the image processing works correctly:

1. Update the return value to include adding the recognized ingredient to the database
2. Extend the UI to show images alongside recognized ingredients

## Troubleshooting

- **Error with RGB565 conversion**: Ensure the RGB565 data is properly formatted and the width/height headers are accurate
- **Error: ENOENT no such file or directory**: Make sure the temp directory exists
- **Error: Request entity too large**: Adjust the payload size limit in server.js if needed
- **Timeout errors**: Check network connectivity between ESP32 and server
