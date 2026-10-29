const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
})

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: process.env.PREVIEW_MODE === 'true' ? 'wanderlust_preview' : 'wanderlust_DEV',
    allowed_formats: ['png', 'jpg', 'jpeg'],
    resource_type: 'image',
  },
});


module.exports = {
    cloudinary,
    storage,
};
