const axios = require('axios');

// Simple cache for IMDb metadata
const metadataCache = {};

/**
 * Gets a title from an IMDb ID using the OMDb API
 */
async function getImdbTitle(imdbId) {
    try {
        // Check cache first to reduce API calls
        if (metadataCache[imdbId]) {
            return metadataCache[imdbId];
        }

        // Use OMDb API with your provided API key
        const response = await axios.get(`http://www.omdbapi.com/?i=${imdbId}&apikey=b1e4f11`);

        if (response.data && response.data.Title) {
            const title = response.data.Title;
            // Store in cache for future requests
            metadataCache[imdbId] = title;
            console.log(`Retrieved title from OMDB: ${imdbId} -> "${title}"`);
            return title;
        } else {
            console.log(`No title found for ${imdbId} in OMDB response:`, response.data);

            // Fallback to extracting search term from IMDb ID if API doesn't return a title
            const cleanId = imdbId.replace(/^tt0*/, '');
            metadataCache[imdbId] = cleanId;
            console.log(`Using fallback search term: ${cleanId}`);
            return cleanId;
        }
    } catch (error) {
        console.error(`Error getting IMDb title for ${imdbId}:`, error.message);

        // Fallback on error
        const cleanId = imdbId.replace(/^tt0*/, '');
        metadataCache[imdbId] = cleanId;
        console.log(`Using fallback search term after error: ${cleanId}`);
        return cleanId;
    }
}

module.exports = {
    getImdbTitle
};