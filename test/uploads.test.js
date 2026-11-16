const test = require("node:test");
const assert = require("node:assert/strict");
const { Writable, Readable } = require("node:stream");
const { cloudinary, storage } = require("../cloudConfig");

function saveFile(content) {
    return new Promise((resolve, reject) => {
        storage._handleFile({}, { stream: Readable.from([content]) }, (error, image) => {
            if (error) reject(error);
            else resolve(image);
        });
    });
}

test("listing image storage streams a Cloudinary upload and exposes the saved asset to Multer", async t => {
    const data = Buffer.from("sample image");
    const secureUrl = "https://example.invalid/sample.png";
    const publicId = "wanderlust_DEV/sample";
    const uploaded = [];
    t.mock.method(cloudinary.uploader, "upload_stream", (options, callback) => {
        assert.deepEqual(options.allowed_formats, ["png", "jpg", "jpeg"]);
        assert.equal(options.resource_type, "image");
        return new Writable({
            write(chunk, encoding, done) { uploaded.push(chunk); done(); },
            final(done) { callback(null, { secure_url: secureUrl, public_id: publicId, bytes: data.length }); done(); },
        });
    });
    const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => {});

    const image = await saveFile(data);
    assert.deepEqual(Buffer.concat(uploaded), data);
    assert.deepEqual(image, { path: secureUrl, filename: publicId, size: data.length });
    await new Promise((resolve, reject) => storage._removeFile({}, image, error => error ? reject(error) : resolve()));
    assert.deepEqual(destroy.mock.calls[0].arguments, [publicId, { invalidate: true }]);
});

test("listing image storage passes Cloudinary setup errors to Multer", async t => {
    const failure = new Error("Cloudinary credentials unavailable");
    t.mock.method(cloudinary.uploader, "upload_stream", () => { throw failure; });
    await assert.rejects(saveFile(Buffer.from("sample image")), error => error === failure);
});
