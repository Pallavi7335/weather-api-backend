// मुख्य Node.js सर्वर फ़ाइल (Manager)
// यह आपके Android ऐप और WeatherAPI.com API के बीच काम करता है।

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
// Line 11:
const PORT = 8000; // 3000 की जगह 8000 करें

// **********************************************
// 🛑 यहाँ अपनी असली WeatherAPI.com Key डालें!
// **********************************************
const API_KEY = '4fc134f6f12044f3a5355859251710'; // <--- इसे अपनी Key से बदलें
const API_BASE_URL = 'http://api.weatherapi.com/v1/current.json'; // WeatherAPI URL

// दर सीमा (Rate Limiting)
const limiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 100, 
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(cors()); 
app.use(limiter); 
app.use(express.json());

// 💡 मुख्य API एंडपॉइंट जिसे आपका Android ऐप कॉल करेगा:
// उदाहरण: http://10.0.2.2:3000/api/weather?city=Delhi
app.get('/api/weather', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ error: 'City query parameter is required.' });
    }

    try {
        // 1. WeatherAPI.com API को कॉल करें
        const response = await axios.get(API_BASE_URL, {
            params: {
                key: API_KEY, // API Key
                q: city, // शहर का नाम (City name)
            }
        });

        const data = response.data;
        
        // 2. डेटा को Android ऐप के लिए साफ़ (Clean) करें
        const cleanedData = {
            city: data.location.name,
            country: data.location.country,
            temp: Math.round(data.current.temp_c), // Celsius तापमान
            description: data.current.condition.text, 
            icon: data.current.condition.icon.match(/(\d+)(?=\.png)/)[1], // केवल Icon कोड संख्या (e.g., 113) निकालें
            humidity: data.current.humidity,
            windSpeed: data.current.wind_kph, // km/h में
            pressure: data.current.pressure_mb // mb को hPa में (लगभग बराबर)
        };

        // 3. साफ़ किया हुआ डेटा वापस Android ऐप को भेज दें
        res.json(cleanedData);

    } catch (error) {
        // अगर WeatherAPI से Error आता है
        if (error.response && error.response.status === 400) {
             // 400 अक्सर तब आता है जब शहर नहीं मिलता या Key गलत होती है
            return res.status(404).json({ error: `City '${city}' not found or API Key is invalid.` });
        }
        console.error('External API Error:', error.message);
        res.status(500).json({ error: 'Server could not fetch weather data.' });
    }
});

// 💡 सर्वर को शुरू करें
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local testing URL for Android: http://10.0.2.2:${PORT}`);
});