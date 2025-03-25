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
const char *ssid = "Lark Austin";
const char *password = "uruuz3sh";
const char *serverEndpoint = "http://100.70.68.40:3000/api/image-processing";

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
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_RGB565;

    // Configuration for ESP32-CAM
    config.frame_size = FRAMESIZE_VGA; // 640x480 (more stable than SVGA)
    config.jpeg_quality = 12;          // Not used with RGB565, but set it anyway
    config.fb_count = 2;               // Use 2 frame buffers for better stability
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST; // Get latest frame to avoid buffer overflow

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
    while (WiFi.status() != WL_CONNECTED && attempts < 20) // Limit connection attempts
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

        HTTPClient http;
        http.begin(serverEndpoint);

        // Add headers for RGB565 format
        http.addHeader("Content-Type", "application/octet-stream");
        http.addHeader("X-Image-Format", "RGB565");
        http.addHeader("X-Image-Width", String(fb->width));
        http.addHeader("X-Image-Height", String(fb->height));

        // Send the data with a longer timeout
        http.setTimeout(20000); // 20 seconds timeout for larger images
        int httpCode = http.POST(fb->buf, fb->len);

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
            Serial.printf("HTTP Error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
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

        // Capture and send image (with flash)
        captureAndSendImage(true);

        Serial.println("--- Capture complete ---\n");
    }

    // Small delay to prevent watchdog timer issues
    delay(100);
}
