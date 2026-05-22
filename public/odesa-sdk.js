/* OdesaГра SDK v2 */
window.Odesa = (function() {
    let pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts[pathParts.length - 1] === 'index.html' || pathParts[pathParts.length - 1] === '') {
        pathParts.pop();
    }
    let gameId = pathParts.pop() || 'unknown';
    
    // Internal state
    let config = {
        lang: 'uk',
        sound: true,
        credits: 0
    };
    
    let eventListeners = {
        'config': [],
        'stop': []
    };

    // Listen to messages from dashboard
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ODESAPLAY_CONFIG') {
            config = { ...config, ...e.data.config };
            eventListeners['config'].forEach(cb => cb(config));
        } else if (e.data?.type === 'ODESAPLAY_STOP') {
            eventListeners['stop'].forEach(cb => cb());
        }
    });

    let sdk = {
        gameId: gameId,
        
        // Setup initial configuration (vital for cross-origin game hosting)
        init: function(options) {
            if (options && options.gameId) {
                this.gameId = options.gameId;
                gameId = options.gameId;
            }
            this.ready();
        },

        // Notify dashboard the game is loaded and ready to receive config
        ready: function() {
            window.parent.postMessage({ type: 'ODESAPLAY_READY', gameId: sdk.gameId }, '*');
        },

        // End the game with a final score
        gameOver: function(score) {
            console.log("Odesa SDK: Transmitting score...", score);
            window.parent.postMessage({ type: 'ODESAPLAY_SCORE', score, gameId: sdk.gameId }, '*');
        },
        
        // Listen to config changes (lang, sound toggle)
        onConfig: function(callback) {
            eventListeners['config'].push(callback);
            // Fire immediately with current config
            callback(config);
        },

        // Listen for stop request from dashboard
        onStop: function(callback) {
            eventListeners['stop'].push(callback);
        },
        _removeStopListener: function(callback) {
            const idx = eventListeners['stop'].indexOf(callback);
            if (idx !== -1) eventListeners['stop'].splice(idx, 1);
        },
        
        getConfig: function() {
            return config;
        },
        
        // For backwards compatibility
        win: function(score) {
            this.gameOver(score);
        }
    };

    // Automatically notify the dashboard that this game is ready
    if (document.readyState === 'complete') {
        setTimeout(sdk.ready, 1);
    } else {
        window.addEventListener('load', sdk.ready);
    }
    // Also fire it right away just in case the parent is already listening
    setTimeout(sdk.ready, 10);

    return sdk;
})();
