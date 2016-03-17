"use strict";
var entities = {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = entities;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXRpZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlbnRpdGllcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsSUFBTSxRQUFRLEdBQUc7SUFDYixNQUFNLEVBQUUsVUFBVSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUk7UUFDOUIsTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUM1QixHQUFHLEVBQUUsTUFBTTtZQUNYLElBQUksRUFBRSxNQUFNO1lBQ1osRUFBRSxFQUFFLE1BQU07WUFDVixNQUFNLEVBQUUsTUFBTTtZQUNkLEVBQUUsRUFBRTtnQkFDQSxJQUFJLEVBQUUsTUFBTTtnQkFDWixHQUFHLEVBQUUsSUFBSTthQUNaO1lBQ0QsSUFBSSxFQUFFLE1BQU07U0FDZixFQUFFO1lBQ0MsS0FBSyxFQUFFLEtBQUs7WUFDWixTQUFTLEVBQUUsS0FBSztTQUNuQixDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFVixJQUFJLEVBQUUsQ0FBQztJQUNYLENBQUM7Q0FDSixDQUFBO0FBQ0Q7a0JBQWUsUUFBUSxDQUFBIn0=