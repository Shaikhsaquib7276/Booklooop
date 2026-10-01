const test = require("node:test");
const assert = require("node:assert/strict");
const { bookSchema } = require("../schemas");

const baseBook = {
    title: "Database System Concepts",
    author: "Abraham Silberschatz",
    description: "Used textbook in good condition",
    price: 450,
    condition: "Good",
    category: "Computer Science",
    addressLine: "Main Gate, ABC College, Boisar",
    latitude: 19.801234,
    longitude: 72.789123
};

test("book validation accepts a pickup address and precise coordinates", () => {
    const { error, value } = bookSchema.validate(baseBook);
    assert.equal(error, undefined);
    assert.equal(value.addressLine, baseBook.addressLine);
    assert.equal(value.latitude, baseBook.latitude);
    assert.equal(value.longitude, baseBook.longitude);
});

test("book validation rejects a missing pickup location", () => {
    const { error } = bookSchema.validate({
        ...baseBook,
        addressLine: undefined,
        latitude: undefined,
        longitude: undefined
    });

    assert.ok(error);
    assert.match(error.message, /addressLine|latitude|longitude/);
});

test("book validation rejects invalid coordinates", () => {
    const { error } = bookSchema.validate({
        ...baseBook,
        latitude: 95,
        longitude: 200
    });

    assert.ok(error);
    assert.match(error.message, /latitude|longitude/);
});
