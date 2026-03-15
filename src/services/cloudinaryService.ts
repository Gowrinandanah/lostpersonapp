import { Config } from "../constants/config";

const CLOUD_NAME = "dmbddu6fk"; // Replace with your actual cloud name
const UPLOAD_PRESET = Config.cloudinary.uploadPreset;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export const uploadImageToCloudinary = async (
  imageUri: string
): Promise<UploadResult> => {
  const formData = new FormData();

  // React Native file object
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", Config.cloudinary.folder);

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Image upload failed");
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  };
};

export const getOptimizedImageUrl = (
  publicId: string,
  width = 400,
  height = 400
): string => {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_${width},h_${height},q_auto,f_auto/${publicId}`;
};