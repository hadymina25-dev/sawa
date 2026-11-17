// شكل أي ميديا مرفوعة على Cloudinary. من غير publicId مش هنعرف نمسحها.
const mongoose = require('mongoose');

module.exports = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video'], required: true },
  },
  { _id: false }
);
