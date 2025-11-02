// मुख्य Node.js सर्वर फ़ाइल (Manager)
// यह आपके Android ऐप और WeatherAPI.com API के बीच काम करता है।

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const moment = require('moment'); 

const app = express();
// ✅ Fix 1: Render पर PORT Environment Variable का उपयोग करें
const PORT = process.env.PORT || 8000; 

// **********************************************
// 🛑 यहाँ अपनी असली WeatherAPI.com Key डालें!
// **********************************************
const API_KEY = '4fc134f6f12044f3a5355859251710'; 

// ✅ Weather API URL को forecast.json पर उपयोग करें
const API_BASE_URL = 'http://api.weatherapi.com/v1/forecast.json'; 

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

// 💡 Helper Function: Icon Code को निकालता है (जैसे 113)
const extractIconCode = (iconUrl) => {
    try {
        if (!iconUrl) return null;
        const match = iconUrl.match(/(\d+)(?=\.png)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
};

// 💡 मुख्य API एंडपॉइंट जिसे आपका Android ऐप कॉल करेगा:
// उदाहरण: .../api/weather?city=Delhi OR .../api/weather?city=22.7196,75.8577
app.get('/api/weather', async (req, res) => {
    const query = req.query.city; // 'city' में City Name OR lat,lon हो सकता है

    if (!query) {
        return res.status(400).json({ error: 'City query parameter is required.' });
    }

    try {
        // 1. WeatherAPI.com API को कॉल करें 
        const response = await axios.get(API_BASE_URL, {
            params: {
                key: API_KEY,
                q: query, // यहाँ lat,lon या City Name जाएगा
                days: 1, 
            }
        });

        const data = response.data;
        
        // 🛑 2. Hourly Forecast Data को प्रोसेस करें
        let hourlyData = [];
        
        if (data.forecast && data.forecast.forecastday.length > 0) {
            
            const now = moment(); 
            
            hourlyData = data.forecast.forecastday[0].hour
                .filter(h => moment.unix(h.time_epoch).isAfter(now)) 
                .slice(0, 4) 
                .map(h => ({
                    // ✅ AM/PM फॉर्मेट का उपयोग करें
                    time: moment.unix(h.time_epoch).format('hh:mm A'), 
                    temp: Math.round(h.temp_c), 
                    iconCode: extractIconCode(h.condition.icon),
                }));
        }

        // 3. डेटा को Android ऐप के लिए साफ़ (Clean) करें
        const cleanedData = {
            // ✅ City/Country नाम सीधे API response से लेना सुरक्षित है,
            // क्योंकि API को पता होता है कि किस Lat/Lon से कौन सा नाम जुड़ा है।
            city: data.location.name, 
            country: data.location.country,
            temp: Math.round(data.current.temp_c), 
            description: data.current.condition.text, 
            icon: extractIconCode(data.current.condition.icon), 
            humidity: data.current.humidity,
            windSpeed: data.current.wind_kph,
            pressure: data.current.pressure_mb,
            
            hourly: hourlyData 
        };

        // 4. साफ़ किया हुआ डेटा वापस Android ऐप को भेज दें
        res.json(cleanedData);

    } catch (error) {
        // यह सुनिश्चित करें कि एरर मैसेज में क्रैश का कारण पता चले
        if (error.response) {
            if (error.response.status === 400) {
                return res.status(404).json({ error: `City or Coordinates not found, or API Key is invalid.` });
            }
        }
        console.error('External API Error:', error.message);
        res.status(500).json({ error: 'Server could not fetch weather data.' });
    }
});

// 💡 सर्वर को शुरू करें
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
