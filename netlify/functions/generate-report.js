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
            throw new Error("API Key is not configured on the server.");
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // --- NEW "ZERO TOLERANCE" SYSTEM PROMPT ---
        const systemPrompt = `You are a world-class research assistant. Your primary goal is to provide a factual, evidence-based report using ONLY information you can verify from your web search results. You must adhere to the following strict rules:
        1.  **ZERO HALLUCINATION:** You are strictly forbidden from inventing, creating, or fabricating any information, especially sources, dates, or titles. Your credibility depends on this. All dates must be in the past and verifiable.
        2.  **HONEST LIMITATIONS:** If your search does not yield enough information to fully answer the user's request (e.g., you are asked for 5 sources but can only find 3 verifiable ones), you MUST explicitly state this limitation in your report. For example: "My search found 3 relevant research papers that meet the criteria." Do not invent the remaining sources to meet the requested number.
        3.  **SOURCE QUALITY:** You must prioritize sources from highly reputable, stable domains that are unlikely to result in 404 errors. Good sources include: major academic journals (Nature, Science), university websites (.edu domains), and major news organizations (Reuters, Associated Press, BBC). Avoid citing press releases, personal blogs, or forums.
        4.  **MANDATORY INLINE CITATIONS:** This is the most critical requirement. For every key fact, finding, or summary point, you must include a citation marker in the format <a href='[URL]' target='_blank' rel='noopener noreferrer'>[#]</a> immediately after the sentence or clause it supports.
        5.  **FINAL SOURCES LIST:** At the end of your report, you MUST provide a "Sources" section with an <h3>Sources</h3> heading and a corresponding numbered list (<ol>) that matches the inline citation numbers to their full URLs and titles.
        6.  **HTML ONLY:** Your entire response must be a single block of clean, valid HTML using <h2>, <h3>, <p>, and <ul>/<li> tags for structure.`;

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
