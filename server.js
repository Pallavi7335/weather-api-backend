// मुख्य Node.js सर्वर फ़ाइल (Manager)
// यह आपके Android ऐप और WeatherAPI.com API के बीच काम करता है।

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const moment = require('moment'); 

const app = express();
// Render पर Environment Variable से PORT उठाएँ
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
            
            // केवल अगले 4 घंटों के लिए डेटा मैप करें
            hourlyData = data.forecast.forecastday[0].hour
                .filter(h => moment.unix(h.time_epoch).isAfter(now)) 
                .slice(0, 4) 
                .map(h => ({
                    // समय को "hh:mm A" (AM/PM) फॉर्मेट में फ़ॉर्मेट करें
                    time: moment.unix(h.time_epoch).format('hh:mm A'),
                    temp: Math.round(h.temp_c), 
                    iconCode: extractIconCode(h.condition.icon),
                }));
        }

        // 🛑 3. GPS/City नाम को ठीक से पहचानना
        let cityName = data.location.name;
        let countryName = data.location.country;

        // यदि कोऑर्डिनेट्स भेजे गए थे, तो city/country नाम का उपयोग करें
        if (query.includes(',')) {
            // WeatherAPI.com location.name में अक्सर "Indore" जैसा नाम देता है, 
            // इसलिए इसे सीधे उपयोग करना सुरक्षित है।
            cityName = data.location.name; 
            countryName = data.location.country;
        }


        // 4. डेटा को Android ऐप के लिए साफ़ (Clean) करें
        const cleanedData = {
            // ✅ फिक्स: lat,lon या City Name से आया हुआ नाम उपयोग करें
            city: cityName, 
            country: countryName,
            temp: Math.round(data.current.temp_c), 
            description: data.current.condition.text, 
            icon: extractIconCode(data.current.condition.icon), 
            humidity: data.current.humidity,
            windSpeed: data.current.wind_kph,
            pressure: data.current.pressure_mb,
            
            hourly: hourlyData 
        };

        // 5. साफ़ किया हुआ डेटा वापस Android ऐप को भेज दें
        res.json(cleanedData);

    } catch (error) {
        if (error.response && error.response.status === 400) {
            return res.status(404).json({ error: `City or Coordinates not found, or API Key is invalid.` });
        }
        console.error('External API Error:', error.message);
        res.status(500).json({ error: 'Server could not fetch weather data.' });
    }
});

// 💡 सर्वर को शुरू करें
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
