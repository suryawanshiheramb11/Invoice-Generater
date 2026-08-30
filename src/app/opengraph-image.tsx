import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4F9F6",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "#00A97C",
            color: "#ffffff",
            fontSize: 44,
            fontWeight: 800,
          }}
        >
          IG
        </div>
        <div style={{ marginTop: 32, fontSize: 64, fontWeight: 800, color: "#14231F" }}>Invoice Generator</div>
        <div style={{ marginTop: 16, fontSize: 30, color: "#5B6B65" }}>
          Create professional invoices online — free, no signup required
        </div>
      </div>
    ),
    size
  );
}
