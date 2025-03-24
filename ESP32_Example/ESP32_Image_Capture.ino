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
const char *ssid = "CityofIrving-Guest";
const char *password = "";
const char *serverEndpoint = "http://172.16.128.50:3000/api/image-processing";

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

    // RGB565-specific configuration
    config.frame_size = FRAMESIZE_SVGA; // 800x600 (works with RGB565)
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK)
    {
        Serial.printf("Camera init failed: 0x%x", err);
        delay(1000);
        ESP.restart();
    }

    // Additional sensor settings for RGB565
    sensor_t *s = esp_camera_sensor_get();
    s->set_vflip(s, 1);   // Adjust if your image is flipped
    s->set_hmirror(s, 1); // Adjust if needed
}

// ===================
// WiFi Connection
// ===================
void connectToWiFi()
{
    WiFi.begin(ssid, password);
    WiFi.setSleep(false);

    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

// ===================
// Image Capture & Upload
// ===================
void captureAndSendImage(bool useFlash = false)
{
    if (useFlash)
    {
        digitalWrite(FLASH_LED_PIN, HIGH);
        delay(100);
    }

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb)
    {
        Serial.println("Capture failed");
        return;
    }

    if (useFlash)
        digitalWrite(FLASH_LED_PIN, LOW);

    if (WiFi.status() == WL_CONNECTED)
    {
        HTTPClient http;
        http.begin(serverEndpoint);

        // Send as RGB565 raw data
        http.addHeader("Content-Type", "application/octet-stream");
        http.addHeader("X-Image-Format", "RGB565");
        http.addHeader("X-Image-Width", "800");
        http.addHeader("X-Image-Height", "600");

        int httpCode = http.POST(fb->buf, fb->len);
        if (httpCode > 0)
        {
            Serial.printf("HTTP Response: %d\n", httpCode);
            Serial.println("Server Response: " + http.getString());
        }
        else
        {
            Serial.printf("HTTP Error: %d\n", httpCode);
        }
        http.end();
    }

    esp_camera_fb_return(fb);
}

// ===================
// Main Functions
// ===================
void setup()
{
    Serial.begin(115200);
    Serial.setDebugOutput(true);

    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);

    initializeCamera();
    connectToWiFi();
}

void loop()
{
    captureAndSendImage(true);
    delay(60000);
}
