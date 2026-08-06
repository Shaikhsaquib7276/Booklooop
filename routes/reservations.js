const express = require("express");
const router = express.Router();

const isLoggedIn = require("../middleware/isLoggedIn");
const reservationController = require("../controller/reservationController");
const wrapAsync = require("../utils/wrapAsync");

router.post(
    "/reservations",
    isLoggedIn,
    wrapAsync(reservationController.createReservation)
);

router.get(
    "/reservations",
    isLoggedIn,
    wrapAsync(reservationController.showMyReservations)
);

router.post(
    "/reservations/:id/accept",
    isLoggedIn,
    wrapAsync(reservationController.acceptReservation)
);

router.post(
    "/reservations/:id/reject",
    isLoggedIn,
    wrapAsync(reservationController.rejectReservation)
);

module.exports = router;
