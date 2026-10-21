import mongoose from "mongoose";

// Match photos are private, server-authorized images tied to one Match ID.
// They are not stored in a public/static directory or exposed as public URLs.
const matchPhotoSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    image: { type: String, required: true },
  },
  { timestamps: true }
);

export const MatchPhoto =
  mongoose.models.MatchPhoto || mongoose.model("MatchPhoto", matchPhotoSchema, "match_photos");

export const MAX_MATCH_PHOTO_LENGTH = 90_000;
export const MATCH_PHOTO_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isValidMatchPhoto(image) {
  return (
    typeof image === "string" &&
    image.length > 0 &&
    image.length <= MAX_MATCH_PHOTO_LENGTH &&
    MATCH_PHOTO_DATA_URL_RE.test(image)
  );
}
