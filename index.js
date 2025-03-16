const { addonBuilder, serveHTTP, publishToCentral } = require('stremio-addon-sdk');
const F2Movies = require('./lib/f2movies');

// Initialize the F2Movies client
const f2movies = new F2Movies();

// Create the addon
const addon = new addonBuilder({
    id: 'org.stremio.f2movies',
    version: '1.0.0',
    name: 'F2Movies',
    description: 'Watch movies and TV shows from F2Movies with enhanced metadata from OMDB API',
    logo: 'https://img.f2movies.to/xxrz/100x100/100/97/7c/977c1edd338be92731a89935c3ee18de/977c1edd338be92731a89935c3ee18de.png',
    background: 'https://img.f2movies.to/xxrz/1300x700/100/42/ec/42ec862429a9cc7521a0fc7acdfab714/42ec862429a9cc7521a0fc7acdfab714.png',

    // This line was missing - catalogs must be defined, even if empty
    catalogs: [],

    // Properties that determine when Stremio picks this addon
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'] // This means we'll respond to IMDb IDs
});

// Define the stream handler
addon.defineStreamHandler(async function(args) {
    console.log('Stream request:', args);

    const { type, id } = args;

    try {
        // Parse Stremio ID
        let imdbId, season, episode;

        if (type === 'series') {
            // Format: tt1234567:1:2 (imdbId:season:episode)
            const parts = id.split(':');
            imdbId = parts[0];
            season = parts.length > 1 ? parseInt(parts[1], 10) : 1;
            episode = parts.length > 2 ? parseInt(parts[2], 10) : 1;

            console.log(`Looking for streams for series ${imdbId}, Season ${season}, Episode ${episode}`);

            // Get streams for the TV show episode
            const streams = await f2movies.getSeriesStreams(imdbId, season, episode);
            console.log(`Found ${streams.length} streams for ${imdbId} S${season}E${episode}`);
            return { streams };
        } else {
            // For movies, just use the IMDb ID
            imdbId = id;

            console.log(`Looking for streams for movie ${imdbId}`);

            // Get streams for the movie
            const streams = await f2movies.getMovieStreams(imdbId);
            console.log(`Found ${streams.length} streams for movie ${imdbId}`);
            return { streams };
        }
    } catch (error) {
        console.error('Error in stream handler:', error);
        return { streams: [] };
    }
});

// Serve the addon
const PORT = process.env.PORT || 7000;
serveHTTP(addon.getInterface(), { port: PORT });
console.log(`F2Movies Addon running at http://localhost:${PORT}`);

// Uncomment this line to publish your addon to the central directory
// publishToCentral('https://your-addon-url.com/manifest.json');