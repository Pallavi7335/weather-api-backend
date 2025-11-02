// मुख्य Node.js सर्वर फ़ाइल (Manager)
// यह आपके Android ऐप और WeatherAPI.com API के बीच काम करता है।

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const moment = require('moment'); // 🛑 समय को फ़ॉर्मेट करने के लिए Moment.js लाइब्रेरी का उपयोग करें

const app = express();
const PORT = 8000; 

// **********************************************
// 🛑 यहाँ अपनी असली WeatherAPI.com Key डालें!
// **********************************************
const API_KEY = '4fc134f6f12044f3a5355859251710'; // <--- इसे अपनी Key से बदलें

// ✅ Weather API URL को forecast.json पर बदलें और 'days=1' जोड़ें
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
        const match = iconUrl.match(/(\d+)(?=\.png)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
};

// 💡 मुख्य API एंडपॉइंट जिसे आपका Android ऐप कॉल करेगा:
// उदाहरण: http://10.0.2.2:3000/api/weather?city=Delhi
app.get('/api/weather', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ error: 'City query parameter is required.' });
    }

    try {
        // 1. WeatherAPI.com API को कॉल करें (forecast.json का उपयोग करके)
        const response = await axios.get(API_BASE_URL, {
            params: {
                key: API_KEY, // API Key
                q: city, // शहर का नाम (City name)
                days: 1, // आज का forecast चाहिए
            }
        });

        const data = response.data;
        
        // 🛑 2. Hourly Forecast Data को प्रोसेस करें
        let hourlyData = [];
        
        // forecastday[0].hour में 24 घंटे का डेटा होता है
        if (data.forecast && data.forecast.forecastday.length > 0) {
            
            // वर्तमान समय के बाद से डेटा लें
            const now = moment(); 
            
            // केवल अगले 4 घंटों के लिए डेटा मैप करें
            hourlyData = data.forecast.forecastday[0].hour
                .filter(h => moment.unix(h.time_epoch).isAfter(now)) // वर्तमान समय से बाद का डेटा
                .slice(0, 4) // केवल अगले 4 घंटे लें
                .map(h => ({
                    // समय को "HH:MM" फॉर्मेट में फ़ॉर्मेट करें
                    time: moment.unix(h.time_epoch).format('HH:mm'),
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
            
            // ✅ Hourly Data जोड़ें (यह अब Android App द्वारा पढ़ा जाएगा)
            hourly: hourlyData 
        };

        // 4. साफ़ किया हुआ डेटा वापस Android ऐप को भेज दें
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

    
