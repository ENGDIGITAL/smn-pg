function init(config, options = {}) {
    if (!global.db)
        global.db = new require('pg-promise')()(config);

    return {
        db: global.db,
        request: () => require('./query')(db, { ...config, ...options })
    };
}

module.exports = init;
