import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  Html5Qrcode,
} from "html5-qrcode";

import {
  apiRequest,
} from "../../api/client";

const SCANNER_ID = "dyno-member-qr-reader";

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: {
    width: 250,
    height: 250,
  },
};

function AttendanceScanPage() {
  const navigate = useNavigate();

  const scannerRef = useRef(null);

  const mountedRef = useRef(false);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const scanLockedRef = useRef(false);
  const submittingRef = useRef(false);

  const [status, setStatus] = useState(
    "Preparing camera...",
  );

  const [scannerError, setScannerError] = useState("");

  const [result, setResult] = useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  /*
   * ---------------------------------------------------------
   * STOP SCANNER SAFELY
   * ---------------------------------------------------------
   *
   * html5-qrcode throws errors when stop() is called while
   * the scanner is already stopped or its DOM element has
   * disappeared.
   *
   * This function intentionally swallows those lifecycle
   * errors because camera cleanup should never crash React.
   */

  const stopScanner = useCallback(
    async () => {
      const scanner = scannerRef.current;

      if (!scanner) {
        runningRef.current = false;
        return;
      }

      if (stoppingRef.current) {
        return;
      }

      stoppingRef.current = true;

      try {
        if (runningRef.current) {
          try {
            await scanner.stop();
          } catch (error) {
            console.debug(
              "QR scanner stop ignored:",
              error,
            );
          }
        }
      } finally {
        runningRef.current = false;

        /*
         * Do NOT depend on the scanner DOM element still
         * existing here.
         */
        try {
          scanner.clear();
        } catch (error) {
          console.debug(
            "QR scanner clear ignored:",
            error,
          );
        }

        stoppingRef.current = false;
      }
    },
    [],
  );

  /*
   * ---------------------------------------------------------
   * HANDLE QR RESULT
   * ---------------------------------------------------------
   */

  const handleScan = useCallback(
    async (qrToken) => {
      if (
        !qrToken ||
        submittingRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      submittingRef.current = true;
      scanLockedRef.current = true;

      setIsSubmitting(true);
      setScannerError("");
      setStatus("Verifying gym QR...");

      /*
       * IMPORTANT:
       *
       * Stop the camera BEFORE changing the result state.
       *
       * The previous implementation changed the UI first,
       * which removed the scanner DOM node while html5-qrcode
       * was still using it.
       */
      await stopScanner();

      if (!mountedRef.current) {
        return;
      }

      try {
        const data = await apiRequest(
          "/attendance/qr-scan/",
          {
            method: "POST",
            body: JSON.stringify({
              qr_token: qrToken,
            }),
          },
        );

        if (!mountedRef.current) {
          return;
        }

        setResult({
          type: "success",
          message:
            data?.detail ||
            "Attendance marked successfully.",
          attendance:
            data?.attendance || null,
        });

        setStatus("");
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        const message =
          error?.message ||
          "Unable to mark attendance.";

        setResult({
          type: "error",
          message,
        });

        setStatus("");
      } finally {
        if (!mountedRef.current) {
          return;
        }

        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [stopScanner],
  );

  /*
   * ---------------------------------------------------------
   * START SCANNER
   * ---------------------------------------------------------
   */

  const startScanner = useCallback(async () => {
    if (
      !mountedRef.current ||
      startingRef.current ||
      runningRef.current ||
      stoppingRef.current
    ) {
      return;
    }

    const element =
      document.getElementById(SCANNER_ID);

    if (!element) {
      setScannerError(
        "Scanner could not be initialized. Please reload the page.",
      );

      return;
    }

    startingRef.current = true;

    try {
      setScannerError("");
      setStatus("Requesting camera access...");

      const scanner = scannerRef.current;

      if (!scanner) {
        const newScanner =
          new Html5Qrcode(SCANNER_ID);

        scannerRef.current = newScanner;
      }

      const activeScanner =
        scannerRef.current;

      await activeScanner.start(
        {
          facingMode: "environment",
        },
        SCANNER_CONFIG,
        async (decodedText) => {
          if (
            !mountedRef.current ||
            submittingRef.current ||
            scanLockedRef.current
          ) {
            return;
          }

          scanLockedRef.current = true;

          await handleScan(decodedText);
        },
        () => {
          /*
           * html5-qrcode calls this frequently while
           * searching for a QR code.
           *
           * Do nothing here.
           */
        },
      );

      if (!mountedRef.current) {
        try {
          await activeScanner.stop();
        } catch {}

        return;
      }

      runningRef.current = true;

      setStatus(
        "Align the gym QR code inside the frame",
      );
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      console.error(
        "QR scanner start error:",
        error,
      );

      runningRef.current = false;

      setStatus("");

      setScannerError(
        "Camera access was unavailable. Please allow camera permission and try again.",
      );
    } finally {
      startingRef.current = false;
    }
  }, [handleScan]);

  /*
   * ---------------------------------------------------------
   * RESET / SCAN AGAIN
   * ---------------------------------------------------------
   */

  const scanAgain = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setResult(null);
    setScannerError("");

    submittingRef.current = false;
    scanLockedRef.current = false;

    setIsSubmitting(false);
    setStatus("Starting camera...");

    /*
     * Give React one frame to restore the scanner container
     * before html5-qrcode starts using it again.
     */
    window.requestAnimationFrame(() => {
      if (!mountedRef.current) {
        return;
      }

      startScanner();
    });
  }, [startScanner]);

  /*
   * ---------------------------------------------------------
   * INITIALIZE SCANNER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      /*
       * Wait until the scanner DOM element has actually
       * mounted.
       */
      await new Promise((resolve) => {
        window.requestAnimationFrame(resolve);
      });

      if (!mountedRef.current) {
        return;
      }

      await startScanner();
    };

    initialize();

    return () => {
      mountedRef.current = false;

      scanLockedRef.current = true;
      submittingRef.current = false;

      /*
       * Camera cleanup happens asynchronously.
       * React must NOT wait for it.
       */
      stopScanner();

      scannerRef.current = null;
    };
  }, [startScanner, stopScanner]);

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * The scanner DOM element is ALWAYS rendered.
   *
   * We only hide it when displaying the result.
   *
   * This prevents html5-qrcode from trying to access a DOM
   * element that React has already removed.
   */

  return (
    <main className="qr-scan-page">
      <style>
        {`
          .qr-scan-page {
            min-height: 100vh;
            background: #f5f5f3;
            color: #111111;
            padding: 28px 24px 48px;
            box-sizing: border-box;
          }

          .qr-scan-shell {
            width: 100%;
            max-width: 760px;
            min-height: calc(100vh - 76px);
            margin: 0 auto;
            display: flex;
            flex-direction: column;
          }

          .qr-scan-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }

          .qr-back-button {
            border: 1px solid #111111;
            background: transparent;
            color: #111111;
            padding: 10px 16px;
            font-family: Inter, Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
            cursor: pointer;
            transition:
              background 160ms ease,
              color 160ms ease;
          }

          .qr-back-button:hover {
            background: #111111;
            color: #ffffff;
          }

          .qr-brand {
            font-family: "Bebas Neue", Impact, sans-serif;
            font-size: 20px;
            letter-spacing: 0.08em;
          }

          .qr-brand span {
            color: #c2182b;
          }

          .qr-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px 0 40px;
          }

          .qr-eyebrow {
            margin: 0 0 8px;
            color: #c2182b;
            font-family: Inter, Arial, sans-serif;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .qr-title {
            margin: 0;
            font-family: "Bebas Neue", Impact, sans-serif;
            font-size: clamp(48px, 8vw, 76px);
            font-weight: 400;
            line-height: 0.9;
            letter-spacing: 0.01em;
          }

          .qr-description {
            max-width: 440px;
            margin: 16px auto 28px;
            color: #666666;
            font-family: Inter, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
          }

          .qr-scanner-card {
            width: min(100%, 420px);
            padding: 14px;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #dededb;
            border-radius: 28px;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
          }

          .qr-scanner-frame {
            position: relative;
            width: 100%;
            aspect-ratio: 1 / 1;
            overflow: hidden;
            background: #111111;
            border-radius: 20px;
          }

          #dyno-member-qr-reader {
            width: 100%;
            height: 100%;
          }

          #dyno-member-qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block;
          }

          #dyno-member-qr-reader img {
            display: none !important;
          }

          #dyno-member-qr-reader__scan_region {
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            border: 0 !important;
          }

          #dyno-member-qr-reader__dashboard {
            display: none !important;
          }

          .qr-corners {
            position: absolute;
            inset: 50%;
            width: 230px;
            height: 230px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 5;
          }

          .qr-corner {
            position: absolute;
            width: 38px;
            height: 38px;
            border-color: #c2182b;
            border-style: solid;
          }

          .qr-corner.top-left {
            top: 0;
            left: 0;
            border-width: 4px 0 0 4px;
          }

          .qr-corner.top-right {
            top: 0;
            right: 0;
            border-width: 4px 4px 0 0;
          }

          .qr-corner.bottom-left {
            bottom: 0;
            left: 0;
            border-width: 0 0 4px 4px;
          }

          .qr-corner.bottom-right {
            right: 0;
            bottom: 0;
            border-width: 0 4px 4px 0;
          }

          .qr-scan-line {
            position: absolute;
            left: 12px;
            right: 12px;
            top: 50%;
            height: 2px;
            background: #c2182b;
            box-shadow: 0 0 12px rgba(194, 24, 43, 0.8);
            animation: dynoScanLine 2s ease-in-out infinite;
          }

          @keyframes dynoScanLine {
            0%,
            100% {
              transform: translateY(-105px);
              opacity: 0.5;
            }

            50% {
              transform: translateY(105px);
              opacity: 1;
            }
          }

          .qr-status {
            margin-top: 18px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 9px 14px;
            border-radius: 999px;
            background: #111111;
            color: #ffffff;
            font-family: Inter, Arial, sans-serif;
            font-size: 12px;
            font-weight: 700;
          }

          .qr-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #c2182b;
            box-shadow: 0 0 8px rgba(194, 24, 43, 0.7);
          }

          .qr-error {
            width: min(100%, 420px);
            box-sizing: border-box;
            margin-top: 18px;
            padding: 16px 18px;
            border: 1px solid #e0b8bd;
            border-radius: 16px;
            background: #fff4f5;
            color: #8f1725;
            font-family: Inter, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
          }

          .qr-result {
            width: min(100%, 420px);
            box-sizing: border-box;
            padding: 30px;
            background: #ffffff;
            border: 1px solid #dededb;
            border-radius: 28px;
            text-align: center;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
          }

          .qr-result-mark {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: #c2182b;
            color: #ffffff;
            font-size: 30px;
            font-weight: 700;
          }

          .qr-result.error .qr-result-mark {
            background: #111111;
          }

          .qr-result h2 {
            margin: 0 0 10px;
            font-family: "Bebas Neue", Impact, sans-serif;
            font-size: 38px;
            font-weight: 400;
          }

          .qr-result p {
            margin: 8px 0;
            color: #666666;
            font-family: Inter, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
          }

          .qr-result-button {
            width: 100%;
            margin-top: 20px;
            padding: 14px 18px;
            border: 0;
            background: #111111;
            color: #ffffff;
            font-family: Inter, Arial, sans-serif;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            cursor: pointer;
          }

          .qr-result-button:hover {
            background: #c2182b;
          }

          .qr-footer {
            margin-top: auto;
            color: #999999;
            font-family: Inter, Arial, sans-serif;
            font-size: 10px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          @media (max-width: 600px) {
            .qr-scan-page {
              padding: 18px 16px 30px;
            }

            .qr-scan-shell {
              min-height: calc(100vh - 48px);
            }

            .qr-scan-topbar {
              margin-bottom: 12px;
            }

            .qr-brand {
              font-size: 17px;
            }

            .qr-back-button {
              padding: 9px 12px;
              font-size: 11px;
            }

            .qr-content {
              padding-top: 10px;
            }

            .qr-title {
              font-size: 54px;
            }

            .qr-description {
              margin-bottom: 22px;
              font-size: 13px;
            }

            .qr-scanner-card {
              width: min(100%, 380px);
              padding: 10px;
              border-radius: 22px;
            }

            .qr-scanner-frame {
              border-radius: 16px;
            }

            .qr-corners {
              width: 210px;
              height: 210px;
            }

            .qr-corner {
              width: 32px;
              height: 32px;
            }
          }
        `}
      </style>

      <div className="qr-scan-shell">

        {/* TOP BAR */}

        <div className="qr-scan-topbar">
          <button
            type="button"
            className="qr-back-button"
            onClick={() =>
              navigate("/member/attendance")
            }
          >
            ← BACK
          </button>

          <div className="qr-brand">
            DYNO <span>FITNESS</span>
          </div>
        </div>

        {/* CONTENT */}

        <div className="qr-content">

          <p className="qr-eyebrow">
            Member attendance
          </p>

          <h1 className="qr-title">
            SCAN IN
          </h1>

          {!result && (
            <p className="qr-description">
              Scan the QR code displayed at the gym
              entrance to record today's attendance.
            </p>
          )}

          {/* -------------------------------------------------
             SCANNER
             -------------------------------------------------
             IMPORTANT:
             This element stays mounted even after scanning.
          ------------------------------------------------- */}

          <div
            className="qr-scanner-card"
            style={{
              display: result
                ? "none"
                : "block",
            }}
          >
            <div className="qr-scanner-frame">

              <div id={SCANNER_ID} />

              <div className="qr-corners">
                <div className="qr-corner top-left" />
                <div className="qr-corner top-right" />
                <div className="qr-corner bottom-left" />
                <div className="qr-corner bottom-right" />

                <div className="qr-scan-line" />
              </div>

            </div>
          </div>

          {/* STATUS */}

          {!result &&
            !scannerError &&
            status && (
              <div className="qr-status">
                <span className="qr-status-dot" />
                {status}
              </div>
            )}

          {/* CAMERA ERROR */}

          {!result && scannerError && (
            <div className="qr-error">
              {scannerError}
            </div>
          )}

          {/* -------------------------------------------------
             RESULT
          ------------------------------------------------- */}

          {result && (
            <div
              className={`qr-result ${result.type}`}
            >
              <div className="qr-result-mark">
                {result.type === "success"
                  ? "✓"
                  : "!"}
              </div>

              <h2>
                {result.type === "success"
                  ? "ATTENDANCE MARKED"
                  : "SCAN NOT COMPLETED"}
              </h2>

              <p>
                {result.message}
              </p>

              {result.attendance && (
                <p>
                  Attendance recorded for today.
                </p>
              )}

              <button
                type="button"
                className="qr-result-button"
                onClick={scanAgain}
                disabled={isSubmitting}
              >
                SCAN AGAIN
              </button>

              <button
                type="button"
                className="qr-result-button"
                onClick={() =>
                  navigate(
                    "/member/attendance",
                  )
                }
                disabled={isSubmitting}
                style={{
                  marginTop: "10px",
                  background: "#FFFFFF",
                  color: "#111111",
                  border:
                    "1px solid #D8D8D4",
                }}
              >
                VIEW ATTENDANCE
              </button>
            </div>
          )}

        </div>

        <div className="qr-footer">
          DYNO FITNESS · ATTENDANCE
        </div>

      </div>
    </main>
  );
}

export default AttendanceScanPage;