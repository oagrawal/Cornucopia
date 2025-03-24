# ESP32-CAM Setup for Ingredient Recognition

This folder contains the code to use an ESP32-CAM module to capture ingredient images and send them to the server for AI-based ingredient recognition.

## Hardware Requirements

- AI Thinker ESP32-CAM module
- FTDI programmer or USB-to-TTL adapter for uploading code
- 5V power supply
- Breadboard and jumper wires

## Software Requirements

- Arduino IDE
- ESP32 board package installed in Arduino IDE
- Required libraries:
  - ESP32 Camera library

## Setup Instructions

### 1. Install Arduino IDE and ESP32 Board Package

1. Download and install the [Arduino IDE](https://www.arduino.cc/en/software)
2. Open Arduino IDE and go to File > Preferences
3. Add `https://dl.espressif.com/dl/package_esp32_index.json` to Additional Boards Manager URLs
4. Go to Tools > Board > Boards Manager, search for ESP32, and install the ESP32 board package

### 2. Connect ESP32-CAM to FTDI Programmer

For programming, connect the ESP32-CAM to an FTDI programmer as follows:

- ESP32-CAM 5V → FTDI 5V or VCC
- ESP32-CAM GND → FTDI GND
- ESP32-CAM U0R (Pin 3) → FTDI TX
- ESP32-CAM U0T (Pin 1) → FTDI RX
- Connect GPIO 0 to GND (for flashing mode)

### 3. Configure the Sketch

1. Open `ESP32_Image_Capture.ino` in Arduino IDE
2. Update the following variables with your settings:
   ```
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* serverEndpoint = "http://your-server-ip:3000/api/image-processing";
   ```
3. Set `flashLightEnabled = true` if you want to use the flash LED during image capture

### 4. Upload the Sketch

1. In Arduino IDE, select Tools > Board > ESP32 Arduino > AI Thinker ESP32-CAM
2. Select the appropriate port
3. Press the reset button on the ESP32-CAM
4. Click Upload in Arduino IDE
5. After upload is complete, disconnect GPIO 0 from GND
6. Press the reset button to start the program

### 5. Monitoring

- Open the Serial Monitor in Arduino IDE (115200 baud) to see debug messages
- The ESP32-CAM will capture an image, send it to the server, and wait 60 seconds before the next capture

## Troubleshooting

- If the camera fails to initialize, check the connections and power supply
- If WiFi connection fails, verify your credentials and ensure the ESP32-CAM is within range of your WiFi router
- If image upload fails, verify your server endpoint URL and ensure the server is running
