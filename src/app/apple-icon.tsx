import { ImageResponse } from "next/og";

// PNG brand mark — used as the iOS home-screen icon and as the logo inside Razorpay Checkout.
export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1324",
        }}
      >
        <svg width="168" height="152" viewBox="0 0 40 36" fill="none">
          <path d="M20 2 L38 34 H2 Z" stroke="#f4efe6" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9.3 21 H30.7" stroke="#f4efe6" strokeWidth="2" strokeLinecap="round" />
          <circle cx="20" cy="2.6" r="2.6" fill="#ddb774" />
        </svg>
      </div>
    ),
    size,
  );
}
