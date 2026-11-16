const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const uploadOptions = {
    folder: process.env.PREVIEW_MODE === "true" ? "wanderlust_preview" : "wanderlust_DEV",
    allowed_formats: ["png", "jpg", "jpeg"],
    resource_type: "image",
    disable_promises: true,
};

const storage = {
    _handleFile(req, file, callback) {
        let upload;
        let settled = false;
        const complete = (error, result) => {
            if (settled) return;
            settled = true;
            if (error) {
                if (upload) file.stream.unpipe(upload);
                file.stream.resume();
                return callback(error);
            }
            callback(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
        };

        try {
            upload = cloudinary.uploader.upload_stream(uploadOptions, complete);
        } catch (error) {
            return complete(error);
        }
        if (settled) return;
        upload.once("error", complete);
        file.stream.pipe(upload);
    },
    async _removeFile(req, file, callback) {
        try { await cloudinary.uploader.destroy(file.filename, { invalidate: true }); }
        catch (error) { return callback(error); }
        callback(null);
    },
};

module.exports = { cloudinary, storage };
