import { ImageResponse } from "next/og";

export const alt = "AdaptivAI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function BrandCard() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#0B0B0F",
        color: "#FAFAFA",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(520px circle at 18% 18%, rgba(255,122,24,0.18), transparent 60%), radial-gradient(720px circle at 82% 8%, rgba(168,85,247,0.18), transparent 62%), radial-gradient(760px circle at 55% 100%, rgba(37,99,235,0.18), transparent 58%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 28,
          borderRadius: 36,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
            <g stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 54 L32 12 L48 54" strokeWidth="5.5" />
              <path d="M22 40 H27.5 L31.5 33.5 L35 42 H42" strokeWidth="4.5" />
            </g>
          </svg>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" }}>
            AdaptivAI
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
          <div
            style={{
              display: "flex",
              fontSize: 66,
              lineHeight: 1.04,
              fontWeight: 650,
              letterSpacing: "-0.05em",
            }}
          >
            Adaptive training for real life.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.35,
              color: "rgba(250,250,250,0.74)",
            }}
          >
            Plans that respond to fatigue, schedule, and goals for runners, cyclists, swimmers, and triathletes.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {["AI Coach", "Daily Check-in", "Calendar-first"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                height: 42,
                padding: "0 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.05)",
                fontSize: 20,
                color: "rgba(250,250,250,0.88)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(<BrandCard />, size);
}
