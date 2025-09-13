import { NextResponse } from 'next/server';
import cloudinary from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req) {
  const body = await req.json();
  const { paramsToSign } = body;

  console.log('paramsToSign', paramsToSign);

  // Add the folder parameter to paramsToSign
  paramsToSign.folder = 'buyitnow/avatars';

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET,
  );

  return NextResponse.json({ signature });
}
