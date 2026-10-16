import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { QRCodeSVG } from "qrcode.react";

import { apiRequest } from "../../api/client";

function GymQRPage() {
  const navigate = useNavigate();

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadQRCode = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        "/attendance/qr/",
      );

      setQrData(data);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to load the gym QR code.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQRCode();
  }, [loadQRCode]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F5F5F3",
        color: "#111111",
        padding: "32px 20px",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() =>
                navigate("/staff/dashboard")
              }
              style={{
                border: "1px solid #111111",
                borderRadius: "10px",
                padding: "10px 14px",
                background: "#FFFFFF",
                color: "#111111",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              ← DASHBOARD
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/staff/attendance")
              }
              style={{
                border: "1px solid #D8D8D4",
                borderRadius: "10px",
                padding: "10px 14px",
                background: "#FFFFFF",
                color: "#111111",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              ATTENDANCE
            </button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#C2182B",
            }}
          >
            Dyno Fitness
          </p>

          <h1
            style={{
              margin: "8px 0 0",
              fontSize: "36px",
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            Gym Check-In
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#666666",
              fontSize: "15px",
              lineHeight: 1.5,
            }}
          >
            Keep this QR code open at the gym.
            Members can scan it to record
            their attendance.
          </p>
        </header>

        <section
          style={{
            background: "#FFFFFF",
            border: "1px solid #E4E4E1",
            borderRadius: "24px",
            padding: "28px",
            boxShadow:
              "0 16px 45px rgba(0, 0, 0, 0.06)",
          }}
        >
          {loading && (
            <div
              style={{
                minHeight: "360px",
                display: "grid",
                placeItems: "center",
                color: "#666666",
                fontSize: "14px",
              }}
            >
              Loading today&apos;s QR code...
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: "24px",
                borderRadius: "16px",
                background: "#FFF1F2",
                color: "#9F1239",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Unable to load QR
              </strong>

              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </p>

              <button
                type="button"
                onClick={loadQRCode}
                style={{
                  marginTop: "18px",
                  border: 0,
                  borderRadius: "10px",
                  padding: "11px 16px",
                  background: "#111111",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && qrData && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "24px",
                  background: "#FFFFFF",
                  borderRadius: "18px",
                }}
              >
                <QRCodeSVG
                  value={qrData.qr_token}
                  size={320}
                  level="M"
                  includeMargin
                  bgColor="#FFFFFF"
                  fgColor="#111111"
                />
              </div>

              <div
                style={{
                  marginTop: "24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#888888",
                  }}
                >
                  Today&apos;s gym QR
                </p>

                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  {qrData.date}
                </p>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  paddingTop: "20px",
                  borderTop: "1px solid #E8E8E5",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={loadQRCode}
                  disabled={loading}
                  style={{
                    border: "1px solid #D8D8D4",
                    borderRadius: "10px",
                    padding: "11px 18px",
                    background: "#FFFFFF",
                    color: "#111111",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Refresh QR
                </button>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default GymQRPage;