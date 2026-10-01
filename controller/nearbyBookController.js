const Book = require("../models/Book");

const allowedRadii = [1, 5, 10, 20, 50];

module.exports.index = async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 120);
    const radiusValue = Number.parseInt(req.query.radius, 10);
    const radius = allowedRadii.includes(radiusValue) ? radiusValue : 10;
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
        && req.query.lat !== undefined && req.query.lng !== undefined;

    let books = [];
    let locationError = "";

    if (hasLocation) {
        const filter = {
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: radius * 1000
                }
            },
            $and: [
                { $or: [{ status: "Available" }, { status: { $exists: false } }] },
                { $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }] }
            ]
        };

        if (q) {
            filter.title = {
                $regex: q.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"),
                $options: "i"
            };
        }

        books = await Book.find(filter)
            .populate("owner", "username city college accountType shopName shopAddress")
            .limit(100)
            .lean();

        books = books.map(book => {
            const coords = book.location && book.location.coordinates;
            const distanceKm = coords && coords.length === 2
                ? haversineKm(lat, lng, coords[1], coords[0])
                : null;
            return { ...book, distanceKm };
        });
    } else {
        locationError = "Allow location access or enter your location to find nearby listings.";
    }

    res.render("books/nearby", {
        title: "Nearby Book Finder",
        q,
        radius,
        books,
        hasLocation,
        locationError,
        searchLat: hasLocation ? lat : "",
        searchLng: hasLocation ? lng : ""
    });
};

function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}