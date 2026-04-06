import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const app = express();
app.use(cors());

const port = process.env.PORT || 3000;
const exchangerateKEY = process.env.EXCHANGE_RATE_API_KEY;
const coingeckoKEY = process.env.COINGECKO_API_KEY;
const rapidKEY = process.env.RAPID_API_KEY;
const alphavantageKEY = process.env.ALPHAVANTAGE_API_KEY;
const finnhubKEY = process.env.FINNHUB_API_KEY;
const twelvedataKEY = process.env.TWELVEDATA_API_KEY;


function findDateIdx(fullDate, arr) {
    const date = new Date(fullDate);
    const n = arr.length;
    let left = 0, right = n - 1;
    while (left <= right) {
        let mid = Math.floor(left + (right - left) / 2);
        let midDateItem = arr[mid].date;
        let midDate = new Date(midDateItem);
        if (date.getTime() === midDate.getTime()) {
            return mid;
        } else if (date > midDate) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return left == n ? left - 1 : left;
}

function objectToArrayDates(key, dateField, arr) {
    const datesObject = arr[key];
    const datesArray = Object.keys(datesObject).map(field => {
        return { date: field, price: datesObject[field][dateField] }
    });
    datesArray.sort((a, b) => b - a);
    return datesArray;
}


app.get("/api/trending/crypto", async (req, res) => {
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/search/trending`, {
            method: "GET",
            headers: { 'x-cg-demo-api-key': coingeckoKEY }
        });
        const cryptosData = await response.json();
        const cryptoCurs = cryptosData.coins.map(crypto => {
            const item = crypto.item;
            if (!item || !item.data) {
                return null;
            }
            return {
                name: item.name,
                curPriceUSD: item.data.price ?? null,
                changePerUSD: item.data.price_change_percentage_24h.usd ?? null
            }
        }).filter(Boolean);
        res.status(200).json(cryptoCurs);
    } catch (err) {
        res.status(500).json({ error: "Failed to trending crypto currencies.", details: err.message });
    }
});


app.get("/api/trending/stocks", async (req, res) => {
    try {
        const response = await fetch(`https://yh-finance.p.rapidapi.com/market/v2/get-summary?region=IN`, {
            method: "GET",
            headers: {
                'Content-Type': "application/json",
                'X-Rapidapi-Host': "yh-finance.p.rapidapi.com",
                'X-Rapidapi-Key': rapidKEY
            }
        });
        const stocksData = await response.json();
        const stocks = stocksData.marketSummaryAndSparkResponse.result.map(stock => {
            if (!stock.shortName || !stock.regularMarketPrice || !stock.regularMarketPreviousClose) {
                return null;
            }
            return {
                name: stock.shortName,
                curPrice: stock.regularMarketPrice.raw ?? null,
                prePrice: stock.regularMarketPreviousClose.raw ?? null
            }
        }).filter(Boolean);
        res.status(200).json(stocks);
    } catch (err) {
        res.status(500).json({ error: "Failed to trending stocks.", details: err.message });
    }
});


app.get("/api/news", async (req, res) => {
    try {
        const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKEY}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch news.", details: err.message });
    }
});


app.get("/api/exchange/currency", async (req, res) => {
    const { currency, to } = req.query;
    if (!currency) {
        return res.status(400).json({ error: "Currency is required" });
    }
    try {
        const response = await fetch(to ? `https://v6.exchangerate-api.com/v6/${exchangerateKEY}/pair/${currency}/${to}` : `https://v6.exchangerate-api.com/v6/${exchangerateKEY}/latest/${currency}`);
        if (!response.ok) {
            throw new Error("External API failed");
        }
        const data = await response.json();
        if (!data[to ? "conversion_rate" : "conversion_rates"]) {
            throw new Error("Invalid API response");
        }
        if (to) {
            res.status(200).json({ conversion_rate: data.conversion_rate });
        } else {
            res.status(200).json({ conversion_rates: data.conversion_rates });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch currencies.", details: err.message });
    }
});


app.get("/api/search/stock", async (req, res) => {
    const { stock } = req.query;
    if (!stock) {
        return res.status(400).json({ error: "Stock is required" });
    }
    try {
        const response = await fetch(`https://api.twelvedata.com/symbol_search?symbol=${stock}&apikey=${twelvedataKEY}`);
        if (!response.ok) {
            throw new Error("External API failed");
        }
        const data = await response.json();
        res.status(200).json(data.data);
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch stock latest price.", details: err.message });
    }
});


app.get("/api/search/crypto", async (req, res) => {
    const { crypto } = req.query;
    if (!crypto) {
        return res.status(400).json({ error: "Crypto currency required!" });
    }
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${crypto}`, {
            method: "GET",
            headers: {
                "x-cg-demo-api-key": coingeckoKEY
            }
        });
        if (!response.ok) {
            throw new Error("External API Failed!");
        }
        const data = await response.json();
        res.status(200).json(data.coins);
    } catch (err) {
        res.status(500).json({ error: "Failed to search crypto.", details: err.message });
    }
});


app.get("/api/get/commodity", async (req, res) => {
    const { commodity } = req.query;
    if (!commodity) {
        return res.status(400).json({ error: "Stock is required" });
    }
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=GOLD_SILVER_HISTORY&symbol=${commodity}&interval=daily&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API failed");
        }
        const data = await response.json();
        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        res.status(200).json({ data: { curPriceUSD: data.data[0], prePriceUSD: data.data[1] } });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch commodity price.", details: err.message });
    }
});


app.get("/api/get/stock", async (req, res) => {
    const { stock } = req.query;
    const details = {};
    if (!stock) {
        return res.status(400).json({ error: "Stock is required" });
    }
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stock}&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API failed");
        }
        let data = await response.json();
        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        data = data["Global Quote"];
        if (Object.keys(data).length > 0) {
            details.curPrice = data["05. price"] ?? null;
            details.prePrice = data["08. previous close"] ?? null;
            details.diffPrice = data["09. change"] ?? null;
            details.perDiff = data["10. change percent"] ?? null;
        }
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch stock price.", details: err.message });
    }
    try {
        const response = await fetch(`https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v3/get-profile?symbol=${stock}`, {
            method: "GET",
            headers: {
                'Content-Type': "application/json",
                'X-Rapidapi-Host': "apidojo-yahoo-finance-v1.p.rapidapi.com",
                'X-Rapidapi-Key': rapidKEY
            }
        });
        if (!response.ok) {
            throw new Error("External API failed!");
        }
        const data = await response.json();
        if (data.quoteSummary.result !== null) {
            const stockProfile = data.quoteSummary.result[0].summaryProfile;
            details.address1 = stockProfile?.address1 && stockProfile.address1;
            details.address2 = stockProfile?.address2 && stockProfile.address2;
            details.country = stockProfile?.country && stockProfile.country;
            details.website = stockProfile?.website && stockProfile.website;
            details.industry = stockProfile?.industry && stockProfile.industry;
            details.sector = stockProfile?.sector && stockProfile.sector;
            details.fullTimeEmployees = stockProfile?.fullTimeEmployees && stockProfile.fullTimeEmployees;
            details.desc = stockProfile?.longBusinessSummary && stockProfile.longBusinessSummary;
        }
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch stock profile.", details: err.message });
    }
    res.status(200).json({ data: details });
});


app.get("/api/get/crypto", async (req, res) => {
    const { crypto } = req.query;
    if (!crypto) {
        return res.status(400).json({ error: "Crypto currency required!" });
    }
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${crypto}`, {
            method: "GET",
            headers: {
                "x-cg-demo-api-key": coingeckoKEY
            }
        });
        if (!response.ok) {
            throw new Error("External API Failed!");
        }
        const data = await response.json();
        res.status(200).json({
            data: {
                name: data.name,
                curPrice: data.market_data.current_price.inr,
                diffPrice: data.market_data.price_change_24h_in_currency.inr,
                perDiff: data.market_data.price_change_percentage_24h_in_currency.inr + "%",
                categories: data.categories,
                website: data.links.homepage[0],
                image: data.image.large,
                desc: data.description.en,

            }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to search crypto.", details: err.message, data: {} });
    }
});


app.get("/api/history/currency", async (req, res) => {
    const { from_cur, to_cur, from, to } = req.query;
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from_cur}&to_symbol=${to_cur}&outputsize=full&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API Failed!")
        }
        const data = await response.json();

        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        if (data["Meta Data"] != null) {
            const datesArray = objectToArrayDates("Time Series FX (Daily)", "4. close", data);
            const fromDateIdx = findDateIdx(from, datesArray);
            const toDateIdx = findDateIdx(to, datesArray);
            return res.status(200).json({ data: { fromPrice: datesArray[fromDateIdx], toPrice: datesArray[toDateIdx] } });
        }
        res.status(404).json({ error: "Currency symbol(s) not valid!" })
    } catch (err) {
        res.status(500).json({ error: "Failed to .", details: err.message });
    }
});


app.get("/api/history/stock", async (req, res) => {
    const { stock, from, to } = req.query;
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${stock}&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API Failed!")
        }
        const data = await response.json();
        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        if (data["Meta Data"] != null) {
            const datesArray = objectToArrayDates("Time Series (Daily)", "4. close", data);
            const fromDateIdx = parseInt(findDateIdx(from, datesArray))
            const toDateIdx = parseInt(findDateIdx(to, datesArray))
            return res.status(200).json({ data: { fromPrice: datesArray[fromDateIdx], toPrice: datesArray[toDateIdx] } });
        }

        res.status(404).json({ error: "Stock symbol is invalid!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to .", details: err.message });
    }
});


app.get("/api/history/crypto", async (req, res) => {
    const { crypto, from, to } = req.query;
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${crypto}&market=USD&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API Failed!")
        }
        const data = await response.json();
        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        if (data["Meta Data"] != null) {
            const datesArray = objectToArrayDates("Time Series (Digital Currency Daily)", "4. close", data);
            const fromDateIdx = parseInt(findDateIdx(from, datesArray))
            const toDateIdx = parseInt(findDateIdx(to, datesArray))
            return res.status(200).json({ data: { fromPrice: datesArray[fromDateIdx], toPrice: datesArray[toDateIdx] } });
        }
        res.status(404).json({ error: "Crypto Symbol not found!" })
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch crypto historical data.", details: err.message });
    }
});


app.get("/api/history/commodity", async (req, res) => {
    const { commodity, from, to } = req.query;
    if (!commodity || !from | !to) {
        return res.status(400).json({ error: "All fields are required!" })
    }
    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=GOLD_SILVER_HISTORY&symbol=${commodity}&interval=daily&apikey=${alphavantageKEY}`);
        if (!response.ok) {
            throw new Error("External API Failed!");
        }
        const data = await response.json();
        if ("Information" in data) {
            return res.status(200).json({ data: { apiLimit: "Consumed" } });
        }
        if (data.nominal == "invalid") {
            return res.status(404).json({ error: "commodity not found!" });
        }
        const fromDateIdx = findDateIdx(from, data.data);
        const toDateIdx = findDateIdx(to, data.data);
        res.status(200).json({ data: { fromPrice: data.data[fromDateIdx], toPrice: data.data[toDateIdx] } });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch commodity's historical data.", details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Assets Now v1 API Server started...`);
}); 