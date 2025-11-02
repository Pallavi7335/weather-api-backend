// मुख्य Node.js सर्वर फ़ाइल (Manager)
// यह आपके Android ऐप और WeatherAPI.com API के बीच काम करता है।

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const moment = require('moment'); // 🛑 समय को फ़ॉर्मेट करने के लिए Moment.js लाइब्रेरी का उपयोग करें

const app = express();
// Render से PORT लें, या 8000 का उपयोग करें (Render Deploy के लिए ज़रूरी फिक्स)
const PORT = process.env.PORT || 8000; 

// **********************************************
// 🛑 यहाँ अपनी असली WeatherAPI.com Key डालें!
// **********************************************
const API_KEY = '4fc134f6f12044f3a5355859251710'; 

// Weather API URL को forecast.json पर बदलें
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

// 💡 Helper Function: Icon Code को सुरक्षित रूप से निकालता है (e.g., 113)
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
app.get('/api/weather', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ error: 'City query parameter is required.' });
    }

    try {
        const response = await axios.get(API_BASE_URL, {
            params: {
                key: API_KEY, 
                q: city, 
                days: 1, 
            }
        });

        const data = response.data;
        
        let hourlyData = [];
        
        if (data.forecast && data.forecast.forecastday.length > 0) {
            
            const now = moment(); 
            
            hourlyData = data.forecast.forecastday[0].hour
                .filter(h => moment.unix(h.time_epoch).isAfter(now))
                .slice(0, 4) 
                .map(h => ({
                    // ⭐️ FIX: 24-घंटे (HH:mm) से 12-घंटे (hh:mm A) फॉर्मेट में बदलें
                    time: moment.unix(h.time_epoch).format('hh:mm A'),
                    
                    temp: Math.round(h.temp_c), 
                    iconCode: extractIconCode(h.condition.icon),
                }));
        }

        // 3. डेटा को Android ऐप के लिए साफ़ (Clean) करें
        const cleanedData = {
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

        res.json(cleanedData);

    } catch (error) {
        if (error.response && error.response.status === 400) {
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
