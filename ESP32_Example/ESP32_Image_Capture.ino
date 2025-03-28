#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ===================
// Camera Model Config
// ===================
#define CAMERA_MODEL_AI_THINKER
#define FLASH_LED_PIN 4

// ===================
// Network Config
// ===================
const char *ssid = "utexas-iot";
const char *password = "10961394339849902023";
const char *serverEndpoint = "http://10.159.64.188:3000/api/image-processing";
String serverIP = "10.159.64.188"; // Hardcoded for simplicity


// ===================
// Hardware Pins
// ===================
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

// ===================
// Camera Configuration
// ===================
void initializeCamera()
{
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000; //changed from 20000000 to 10000000 to try and fix EV-EOF error
    //config.pixel_format = PIXFORMAT_RGB565;
    config.pixel_format = PIXFORMAT_JPEG;

    // Configuration for ESP32-CAM
    config.frame_size = FRAMESIZE_VGA; // 640x480 (more stable than SVGA)
    // config.frame_size = FRAMESIZE_SVGA; // 800x600
    // config.frame_size = FRAMESIZE_XGA; // 1024x768
    // config.frame_size = FRAMESIZE_SXGA; // 1280x1024

    config.jpeg_quality = 12;          // Not used with RGB565, but set it anyway
    config.fb_count = 2;               // Use 2 frame buffers for better stability -> increase to 3 or 4 because 2 might be too less
    config.fb_location = CAMERA_FB_IN_PSRAM;
    //config.grab_mode = CAMERA_GRAB_LATEST; // Get latest frame to avoid buffer overflow
    // Use WHEN_EMPTY to prevent frame tearing instead of grab latest
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK)
    {
        Serial.printf("Camera init failed with error 0x%x", err);
        delay(1000);
        ESP.restart();
    }

    // Additional sensor settings
    sensor_t *s = esp_camera_sensor_get();
    if (s)
    {
        // Lower saturation and brightness for better image quality
        s->set_brightness(s, 0);                 // -2 to 2
        s->set_contrast(s, 0);                   // -2 to 2
        s->set_saturation(s, -1);                // -2 to 2
        s->set_special_effect(s, 0);             // 0 = No Effect
        s->set_whitebal(s, 1);                   // 1 = Enable auto white balance
        s->set_awb_gain(s, 1);                   // 1 = Enable AWB gain
        s->set_wb_mode(s, 0);                    // 0 = Auto mode
        s->set_exposure_ctrl(s, 1);              // 1 = Enable auto exposure
        s->set_aec2(s, 0);                       // 0 = Disable AEC DSP
        s->set_gain_ctrl(s, 1);                  // 1 = Enable auto gain
        s->set_agc_gain(s, 0);                   // 0 = No gain
        s->set_gainceiling(s, (gainceiling_t)0); // 0 = 2x gain
        s->set_bpc(s, 0);                        // 0 = Disable black pixel correction
        s->set_wpc(s, 1);                        // 1 = Enable white pixel correction
        s->set_raw_gma(s, 1);                    // 1 = Enable GMA
        s->set_lenc(s, 1);                       // 1 = Enable lens correction
        s->set_hmirror(s, 0);                    // 0 = No horizontal mirror
        s->set_vflip(s, 0);                      // 0 = No vertical flip
        s->set_dcw(s, 1);                        // 1 = Enable DCW
        s->set_colorbar(s, 0);                   // 0 = Disable test pattern


        
        
    }

    Serial.println("Camera initialized successfully");
}

// ===================
// WiFi Connection
// ===================
void connectToWiFi()
{
    WiFi.begin(ssid, password);
    WiFi.setSleep(false);

    Serial.print("Connecting to WiFi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) // Limit connection attempts
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    }
    else
    {
        Serial.println("\nFailed to connect to WiFi! Continuing anyway...");
    }
}

//tests networkconnection in the setup
void testNetworkConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot test network");
    return;
  }
  
  Serial.println("\n--- Network Connection Test ---");
  Serial.println("Performing ping test to server...");
  
  // Parse the server IP from the endpoint URL
  //String serverIP = "10.4.143.246"; // Hardcoded for simplicity
  
  // Create a client to test TCP connection
  WiFiClient client;
  int port = 3000;
  
  Serial.printf("Testing TCP connection to %s:%d\n", serverIP.c_str(), port);
  
  unsigned long startTime = millis();
  if (client.connect(serverIP.c_str(), port)) {
    unsigned long connectionTime = millis() - startTime;
    Serial.printf("Connection successful! Time: %lu ms\n", connectionTime);
    client.stop();
  } else {
    Serial.println("TCP connection failed!");
    Serial.println("Possible reasons:");
    Serial.println(" - Server is not running");
    Serial.println(" - Firewall is blocking connection");
    Serial.println(" - Wrong IP address");
  }
  
  // Print network information
  Serial.printf("ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("Subnet mask: %s\n", WiFi.subnetMask().toString().c_str());
  Serial.printf("Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
  Serial.printf("DNS: %s\n", WiFi.dnsIP().toString().c_str());
  Serial.printf("Signal strength: %d dBm\n", WiFi.RSSI());
  
  Serial.println("--- Network Test Complete ---\n");
}

void checkMemory() {
  Serial.println("\n--- Memory Status ---");
  Serial.printf("Total heap: %d bytes\n", ESP.getHeapSize());
  Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("PSRAM size: %d bytes\n", ESP.getPsramSize());
  Serial.printf("Free PSRAM: %d bytes\n", ESP.getFreePsram());
  
  // Calculate fragmentation
  size_t minFreeBlock = ESP.getMinFreeHeap();
  float fragmentation = 100 - (minFreeBlock * 100.0 / ESP.getFreeHeap());
  Serial.printf("Heap fragmentation: %.2f%%\n", fragmentation);
  
  // Alert if memory is getting low
  if (ESP.getFreeHeap() < 30000) {
    Serial.println("WARNING: Memory is getting low!");
  }
  
  Serial.println("--- End Memory Status ---\n");
}


// ===================
// Image Capture & Upload
// ===================
void captureAndSendImage(bool useFlash = false)
{
    if (useFlash)
    {
        digitalWrite(FLASH_LED_PIN, HIGH);
        delay(100); // Flash warm-up time
    }

    // Get the camera frame buffer
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb)
    {
        Serial.println("Camera capture failed");
        return;
    }

    // Turn off flash if it was on
    if (useFlash)
        digitalWrite(FLASH_LED_PIN, LOW);

    // Print frame buffer info for debugging
    Serial.printf("Image captured! Size: %d bytes, Format: %d, Width: %d, Height: %d\n",
                  fb->len, fb->format, fb->width, fb->height);

    // Check if we're connected to WiFi
    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("Sending image to server...");
        
        //create new http client for each request
        HTTPClient http;
        http.begin(serverEndpoint);

        // Add headers for RGB565 format
        // http.addHeader("Content-Type", "application/octet-stream");
        // http.addHeader("X-Image-Format", "RGB565");
        
        //replace rgb565 headers with following headers for jpeg version
        http.addHeader("Content-Type", "image/jpeg");
        http.addHeader("X-Image-Format", "JPEG");

        http.addHeader("X-Image-Width", String(fb->width));
        http.addHeader("X-Image-Height", String(fb->height));

        // Send the data with a longer timeout
        //http.setTimeout(20000); // 20 seconds timeout for larger images
        //int httpCode = http.POST(fb->buf, fb->len);
        
        // Send the data with a longer timeout upated with better retry logic
        http.setTimeout(30000); // 30 seconds timeout for larger images. consider increasing even more

        //Dynamically adjust timeout based on image size
        // int timeout = max(30000, fb->len / 50); // Base timeout on image size (50 bytes/ms)
        // http.setTimeout(timeout);
        // Serial.printf("Setting timeout to %d ms for %d byte image\n", timeout, fb->len);
 
        // Add retry logic
        int maxRetries = 3;
        int retryCount = 0;
        int httpCode = -1;

        while (retryCount < maxRetries && httpCode < 0) {
            if (retryCount > 0) {
                Serial.printf("Retry attempt %d/%d...\n", retryCount, maxRetries);
                delay(1000 * retryCount); // Progressive backoff
            }
            
            httpCode = http.POST(fb->buf, fb->len);
            
            if (httpCode >= 0) {
                break; // Success, exit retry loop
            }
            
            retryCount++;
        }

        if (httpCode < 0) {
          Serial.println("All HTTP request attempts failed after maximum retries");
        }

        


        // Check HTTP response
        if (httpCode > 0)
        {
            if (httpCode == HTTP_CODE_OK)
            {
                String response = http.getString();
                Serial.printf("HTTP Success, code: %d\n", httpCode);
                Serial.println("Server response: " + response);
            }
            else
            {
                Serial.printf("HTTP Request failed, error code: %d\n", httpCode);
            }
        }
        else
        {
            //Serial.printf("HTTP Error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());

            //enhanced debug information
            Serial.printf("HTTP Error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
            Serial.printf("Trying to connect to: %s\n", serverEndpoint);
            Serial.printf("WiFi status: %d (Connected = %d)\n", WiFi.status(), WL_CONNECTED);
            Serial.printf("ESP32 IP address: %s\n", WiFi.localIP().toString().c_str());
            // We can't get the timeout value, but we can show other useful information
            Serial.printf("Image size being sent: %d bytes\n", fb->len);
            Serial.printf("Free heap memory: %d bytes\n", ESP.getFreeHeap());
        }

        http.end();
    }
    else
    {
        Serial.println("WiFi disconnected, cannot send image");
        // Try to reconnect
        connectToWiFi();
    }

    // Return the frame buffer to be reused
    esp_camera_fb_return(fb);
    delay(100); //added to fix buffer overflow errors 
    Serial.println("Frame buffer released");
}

// ===================
// Main Functions
// ===================
void setup()
{
    Serial.begin(115200);
    Serial.setDebugOutput(true);
    Serial.println("ESP32-CAM Image Capture Starting...");

    // Initialize flash LED
    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);

    // Initialize camera
    initializeCamera();

    // Connect to WiFi
    connectToWiFi();

    //test network connection
    testNetworkConnection();
    
    //checks memory and heap stuff to rule out this as an issue
    checkMemory();

    // Increase I2S buffer size to prevent overflow
    sensor_t *s = esp_camera_sensor_get();
    if (s) {
        s->set_framesize(s, FRAMESIZE_VGA); // Try VGA for more stability
        
        // Add a small delay to let the camera initialize fully
        delay(500);
        
        // Flush any existing frames
        camera_fb_t *fb = esp_camera_fb_get();
        if (fb) {
            esp_camera_fb_return(fb);
        }
    }

    // Flush initial frames which might be corrupted
    for (int i = 0; i < 3; i++) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) {
            esp_camera_fb_return(fb);
            delay(100);
        }
    }

    Serial.println("Setup complete!");
}


void loop()
{
    static unsigned long lastCaptureTime = 0;
    const unsigned long captureInterval = 10000; // 10 seconds

    unsigned long currentTime = millis();

    // Check if it's time to capture a new image
    if (currentTime - lastCaptureTime >= captureInterval)
    {
        Serial.println("\n--- Starting new capture ---");
        lastCaptureTime = currentTime;

        // Make sure WiFi is still connected
        if (WiFi.status() != WL_CONNECTED)
        {
            Serial.println("WiFi disconnected, reconnecting...");
            connectToWiFi();
        }

        //checks memory real quick before capturing and sending image
        checkMemory();
        // Capture and send image (with flash)
        delay(200); //added to fix buffer overflow errors
        captureAndSendImage(true);

        Serial.println("--- Capture complete ---\n");
    }

    // Small delay to prevent watchdog timer issues
    delay(100);
}
