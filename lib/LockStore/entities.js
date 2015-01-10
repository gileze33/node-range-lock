module.exports = {
    define: function (db, models, next) {
        models.lock = db.define("lock", {
            key: String,
            from: String,
            to: String,
            expiry: String,
            id: {
                type: 'text',
                key: true
            },
            data: String
        }, {
            cache: false,
            autoFetch: false
        });

        db.sync();

        next();
    }
};