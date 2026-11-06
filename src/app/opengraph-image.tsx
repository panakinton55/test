import { ImageResponse } from "next/og";

export const alt = "AI Research Studio — Research. Analyze. Decide.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          color: "#1a1c1f",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 6,
            color: "#10243f",
          }}
        >
          AI RESEARCH STUDIO
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 92,
            lineHeight: 0.95,
            letterSpacing: -2,
            fontFamily: "Georgia",
          }}
        >
          <span>Research.</span>
          <span>Analyze.</span>
          <span style={{ fontStyle: "italic", color: "#10243f" }}>Decide.</span>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#3a4047" }}>
          Independent research on markets, companies and emerging technologies.
        </div>
      </div>
    ),
    { ...size },
  );
}
