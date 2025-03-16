const axios = require('axios');
const cheerio = require('cheerio');
const { getImdbTitle } = require('./metadata');

class F2Movies {
    constructor() {
        this.baseUrl = 'https://www6.f2movies.to';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36',
            'Referer': 'https://www6.f2movies.to/'
        };
    }

    async getMovieStreams(imdbId) {
        try {
            // Get title from IMDb ID using OMDB API
            const title = await getImdbTitle(imdbId);
            if (!title) {
                console.log(`No title found for IMDb ID: ${imdbId}`);
                return [];
            }

            console.log(`Searching for movie: "${title}"`);

            // Search for the movie
            const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(title)}`;
            const searchResponse = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(searchResponse.data);

            // Find the movie in search results with better matching
            let bestMatch = null;
            let highestSimilarity = 0;

            $('.flw-item').each((i, el) => {
                const itemType = $(el).find('.fdi-type').text().trim().toLowerCase();
                if (itemType === 'movie') {
                    const itemTitle = $(el).find('.film-name a').text().trim();
                    const similarity = this.calculateSimilarity(title.toLowerCase(), itemTitle.toLowerCase());

                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = $(el);
                    }
                }
            });

            if (!bestMatch) {
                console.log(`Movie not found: "${title}"`);
                return [];
            }

            // Get movie URL
            const movieUrl = this.baseUrl + bestMatch.find('.film-name a').attr('href');
            const foundTitle = bestMatch.find('.film-name a').text().trim();
            console.log(`Found movie: "${foundTitle}" (${highestSimilarity.toFixed(2)} similarity) - URL: ${movieUrl}`);

            // Get movie page
            const movieResponse = await axios.get(movieUrl, { headers: this.headers });
            const $movie = cheerio.load(movieResponse.data);

            // Find server links
            const servers = [];
            $movie('.link-item').each((i, el) => {
                const serverId = $movie(el).attr('data-id');
                const serverName = $movie(el).find('span').text().trim();
                if (serverId) {
                    servers.push({
                        id: serverId,
                        name: serverName
                    });
                }
            });

            // If no servers found, try to extract movieId for building watch URL manually
            if (!servers.length) {
                const movieId = movieUrl.split('/').pop();
                // Try to find server ID from data attributes
                const dataWatchId = $movie('.detail_page-watch').attr('data-watch_id');
                if (dataWatchId) {
                    servers.push({
                        id: dataWatchId,
                        name: 'Default'
                    });
                }
            }

            // Fetch streams from each server
            const streams = [];
            for (const server of servers) {
                const watchUrl = `${this.baseUrl}/watch-movie/${movieUrl.split('/').pop()}.${server.id}`;
                console.log(`Fetching stream from ${server.name} at ${watchUrl}`);

                try {
                    const watchResponse = await axios.get(watchUrl, { headers: this.headers });
                    const $watch = cheerio.load(watchResponse.data);

                    const iframeSrc = $watch('#iframe-embed').attr('src');
                    if (iframeSrc) {
                        streams.push({
                            name: `F2Movies - ${server.name}`,
                            title: `F2Movies - ${server.name}`,
                            url: iframeSrc,
                            behaviorHints: {
                                notWebReady: true
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error getting stream from ${server.name}:`, error.message);
                }
            }

            return streams;
        } catch (error) {
            console.error('Error getting movie streams:', error);
            return [];
        }
    }

    async getSeriesStreams(imdbId, season, episode) {
        try {
            // Get title from IMDb ID using OMDB API
            const title = await getImdbTitle(imdbId);
            if (!title) {
                console.log(`No title found for IMDb ID: ${imdbId}`);
                return [];
            }

            console.log(`Searching for series: "${title}", S${season}E${episode}`);

            // Search for the TV show
            const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(title)}`;
            const searchResponse = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(searchResponse.data);

            // Find the TV show in search results with better matching
            let bestMatch = null;
            let highestSimilarity = 0;

            $('.flw-item').each((i, el) => {
                const itemType = $(el).find('.fdi-type').text().trim().toLowerCase();
                if (itemType === 'tv') {
                    const itemTitle = $(el).find('.film-name a').text().trim();
                    const similarity = this.calculateSimilarity(title.toLowerCase(), itemTitle.toLowerCase());

                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = $(el);
                    }
                }
            });

            if (!bestMatch) {
                console.log(`TV show not found: "${title}"`);
                return [];
            }

            // Get TV show URL
            const seriesUrl = this.baseUrl + bestMatch.find('.film-name a').attr('href');
            const foundTitle = bestMatch.find('.film-name a').text().trim();
            console.log(`Found TV show: "${foundTitle}" (${highestSimilarity.toFixed(2)} similarity) - URL: ${seriesUrl}`);

            // Get TV show page
            const seriesResponse = await axios.get(seriesUrl, { headers: this.headers });
            const $series = cheerio.load(seriesResponse.data);

            // Find the season
            let seasonId;
            $series('.ss-item').each((i, el) => {
                const seasonNumber = parseInt($series(el).text().replace('Season ', ''), 10);
                if (seasonNumber === season) {
                    seasonId = $series(el).attr('data-id');
                }
            });

            if (!seasonId) {
                console.log(`Season ${season} not found for "${title}"`);
                // Try first season as fallback
                seasonId = $series('.ss-item').first().attr('data-id');
                if (!seasonId) {
                    return [];
                }
                console.log(`Using fallback season with ID: ${seasonId}`);
            }

            // Get episodes for the season
            const episodesUrl = `${this.baseUrl}/ajax/season/episodes/${seasonId}`;
            const episodesResponse = await axios.get(episodesUrl, { headers: this.headers });
            const $episodes = cheerio.load(episodesResponse.data);

            // Find the episode
            let episodeId;
            $episodes('.eps-item').each((i, el) => {
                const episodeTitle = $episodes(el).attr('title');
                const match = episodeTitle ? episodeTitle.match(/Eps (\d+):/) : null;
                const episodeNumber = match ? parseInt(match[1], 10) : i + 1;

                if (episodeNumber === episode) {
                    episodeId = $episodes(el).attr('data-id');
                }
            });

            if (!episodeId) {
                console.log(`Episode ${episode} not found for "${title}" S${season}`);
                return [];
            }

            console.log(`Found episode ID: ${episodeId}`);

            // Get servers for the episode
            const serversUrl = `${this.baseUrl}/ajax/episode/servers/${episodeId}`;
            const serversResponse = await axios.get(serversUrl, { headers: this.headers });
            const $servers = cheerio.load(serversResponse.data);

            const servers = [];
            $servers('.link-item').each((i, el) => {
                const serverId = $servers(el).attr('data-id');
                const serverName = $servers(el).find('span').text().trim();
                if (serverId) {
                    servers.push({
                        id: serverId,
                        name: serverName
                    });
                }
            });

            // Fetch streams from each server
            const streams = [];
            const seriesId = seriesUrl.split('/').pop();

            for (const server of servers) {
                const watchUrl = `${this.baseUrl}/watch-tv/${seriesId}.${server.id}`;
                console.log(`Fetching stream from ${server.name} at ${watchUrl}`);

                try {
                    const watchResponse = await axios.get(watchUrl, { headers: this.headers });
                    const $watch = cheerio.load(watchResponse.data);

                    const iframeSrc = $watch('#iframe-embed').attr('src');
                    if (iframeSrc) {
                        streams.push({
                            name: `F2Movies - ${server.name}`,
                            title: `F2Movies - ${server.name} (${foundTitle} S${season}E${episode})`,
                            url: iframeSrc,
                            behaviorHints: {
                                notWebReady: true
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error getting stream from ${server.name}:`, error.message);
                }
            }

            return streams;
        } catch (error) {
            console.error('Error getting series streams:', error);
            return [];
        }
    }

    // Helper method to calculate similarity between two strings
    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 1.0;
        if (str1.length === 0 || str2.length === 0) return 0.0;

        // Check if one string contains the other
        if (str1.includes(str2)) return 0.9;
        if (str2.includes(str1)) return 0.9;

        // Simple Levenshtein distance implementation
        const len1 = str1.length;
        const len2 = str2.length;

        // Create a matrix of distances
        const distance = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));

        // Initialize the matrix
        for (let i = 0; i <= len1; i++) distance[i][0] = i;
        for (let j = 0; j <= len2; j++) distance[0][j] = j;

        // Calculate the Levenshtein distance
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                distance[i][j] = Math.min(
                    distance[i - 1][j] + 1,         // deletion
                    distance[i][j - 1] + 1,         // insertion
                    distance[i - 1][j - 1] + cost   // substitution
                );
            }
        }

        // Calculate similarity based on distance
        const maxLength = Math.max(len1, len2);
        return 1 - distance[len1][len2] / maxLength;
    }
}

module.exports = F2Movies;