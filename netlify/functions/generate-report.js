// This is our secure "middleman" function.
// It runs on Netlify's servers, not in the user's browser.

exports.handler = async function(event, context) {
    // Only allow POST requests.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get the user's question from the request body.
        const { question } = JSON.parse(event.body);

        // Get the secret API key from Netlify's secure environment variables.
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("API Key is not configured.");
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // The same "armored" prompt to ensure factual, cited responses.
        const systemPrompt = `You are a world-class research assistant... (rest of the prompt is the same)`; // Abridged for clarity

        const payload = {
            contents: [{ parts: [{ text: question }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        // Call the Google AI API from the secure server.
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google AI API Error:', errorBody);
            return { statusCode: response.status, body: errorBody };
        }

        const data = await response.json();

        // Send the successful response back to the frontend.
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
