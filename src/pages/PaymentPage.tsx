import React, { useState } from "react";

const UPI_ID = "BHARATPE09899107906@yesbankltd";
const PAYMENT_AMOUNT = "999.00";
const PAYEE_NAME = "HubVault Billing";
const TRANSACTION_NOTE = "HubVault License Payment";

export default function PaymentPage() {
  const [message, setMessage] = useState(
    "Tap the button on your mobile device to open a UPI application."
  );
  const [copied, setCopied] = useState(false);

  const upiUrl =
    "upi://pay" +
    `?pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(PAYEE_NAME)}` +
    `&am=${encodeURIComponent(PAYMENT_AMOUNT)}` +
    "&cu=INR" +
    `&tn=${encodeURIComponent(TRANSACTION_NOTE)}`;

  const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handlePayment = () => {
    if (!isMobileDevice()) {
      setMessage(
        "UPI applications open only on supported mobile devices. Please scan the QR code using your phone."
      );
      return;
    }

    setMessage("Opening your UPI application...");
    window.location.href = upiUrl;

    window.setTimeout(() => {
      setMessage(
        "If the UPI application did not open, scan the QR code or enter the UPI ID manually."
      );
    }, 2500);
  };

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setMessage("UPI ID copied successfully.");

      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Could not copy the UPI ID. Please copy it manually.");
    }
  };

  return (
    <div style={styles.page}>
      <main style={styles.card}>
        <section style={styles.header}>
          <img
            src="/logo.png"
            alt="HubVault"
            style={styles.logo}
          />

          <h1 style={styles.title}>Complete Your Payment</h1>

          <p style={styles.subtitle}>
            Pay securely using any supported UPI application.
          </p>
        </section>

        <section style={styles.content}>
          <div style={styles.amountBox}>
            <div style={styles.amountLabel}>Total Payable Amount</div>
            <div style={styles.amount}>₹999</div>
            <div style={styles.planName}>HubVault License Activation</div>
          </div>

          <div style={styles.upiSection}>
            <div style={styles.sectionLabel}>UPI ID</div>

            <div style={styles.upiBox}>
              <span style={styles.upiText}>{UPI_ID}</span>

              <button
                type="button"
                onClick={handleCopyUpi}
                style={styles.copyButton}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayment}
            style={styles.payButton}
          >
            Pay ₹999 via UPI
          </button>

          <p style={styles.message}>{message}</p>

          <div style={styles.divider} />

          <h2 style={styles.qrTitle}>Scan and Pay</h2>

          <p style={styles.qrText}>
            Scan the QR code using Google Pay, PhonePe, Paytm, BHIM,
            or another supported UPI application.
          </p>

          <div style={styles.qrWrapper}>
            <img
              src="/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png"
              alt="HubVault Payment QR Code"
              style={styles.qrImage}
            />
          </div>

          <div style={styles.steps}>
            <h3 style={styles.stepsTitle}>After Payment</h3>

            <p style={styles.stepText}>
              1. Take a screenshot of the successful payment.
            </p>

            <p style={styles.stepText}>
              2. Reply to the payment email with the screenshot or UTR number.
            </p>

            <p style={styles.stepText}>
              3. Your HubVault license code will be issued after verification.
            </p>
          </div>

          <div style={styles.support}>
            Need help?{" "}
            <a href="mailto:billing@hubvault.in" style={styles.supportLink}>
              Contact HubVault Billing
            </a>
          </div>
        </section>

        <footer style={styles.footer}>
          <strong style={styles.footerStrong}>
            Smarter Collections. Stronger Control.
          </strong>

          <span>© 2026 HubVault. All Rights Reserved.</span>
        </footer>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 14px",
    background:
      "linear-gradient(135deg, #eff6ff 0%, #f8fafc 45%, #ecfdf5 100%)",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#334155",
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    margin: "20px auto",
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
  },
  header: {
    padding: "28px 24px 22px",
    textAlign: "center",
    background: "linear-gradient(135deg, #eff6ff, #ffffff)",
  },
  logo: {
    display: "block",
    width: "210px",
    maxWidth: "82%",
    height: "auto",
    margin: "0 auto 18px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "27px",
    lineHeight: 1.25,
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: "15px",
    lineHeight: "24px",
  },
  content: {
    padding: "26px 24px 30px",
  },
  amountBox: {
    padding: "22px",
    textAlign: "center",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "16px",
  },
  amountLabel: {
    color: "#64748b",
    fontSize: "14px",
  },
  amount: {
    marginTop: "5px",
    color: "#16a34a",
    fontSize: "44px",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  planName: {
    marginTop: "5px",
    color: "#475569",
    fontSize: "14px",
  },
  upiSection: {
    marginTop: "22px",
  },
  sectionLabel: {
    marginBottom: "8px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: 600,
  },
  upiBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
  },
  upiText: {
    flex: 1,
    color: "#1d4ed8",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: "22px",
    wordBreak: "break-all",
  },
  copyButton: {
    flexShrink: 0,
    padding: "9px 13px",
    border: 0,
    borderRadius: "9px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  payButton: {
    display: "block",
    width: "100%",
    marginTop: "22px",
    padding: "17px 18px",
    border: 0,
    borderRadius: "13px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 700,
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(37, 99, 235, 0.28)",
  },
  message: {
    minHeight: "22px",
    margin: "12px 0 0",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "21px",
  },
  divider: {
    height: "1px",
    margin: "26px 0",
    background: "#e2e8f0",
  },
  qrTitle: {
    margin: 0,
    textAlign: "center",
    color: "#0f172a",
    fontSize: "18px",
  },
  qrText: {
    margin: "8px 0 18px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: "22px",
  },
  qrWrapper: {
    textAlign: "center",
  },
  qrImage: {
    display: "inline-block",
    width: "230px",
    maxWidth: "85%",
    height: "auto",
    padding: "8px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
  },
  steps: {
    marginTop: "26px",
    padding: "18px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
  },
  stepsTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: "16px",
  },
  stepText: {
    margin: "8px 0",
    color: "#475569",
    fontSize: "14px",
    lineHeight: "22px",
  },
  support: {
    marginTop: "22px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "21px",
  },
  supportLink: {
    color: "#2563eb",
    fontWeight: 700,
    textDecoration: "none",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "20px",
    background: "#0f172a",
    textAlign: "center",
    color: "#cbd5e1",
    fontSize: "12px",
    lineHeight: "20px",
  },
  footerStrong: {
    color: "#ffffff",
    fontSize: "14px",
  },
};
