import { useState, useMemo } from "react";

const formatINR = (val) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export default function StretchFilmCalculator() {
  const [grossWeight, setGrossWeight] = useState("");
  const [coreWeight, setCoreWeight] = useState("");
  const [ratePerKg, setRatePerKg] = useState("");

  const calc = useMemo(() => {
    const gw = parseFloat(grossWeight);
    const cw = parseFloat(coreWeight);
    const rate = parseFloat(ratePerKg);
    if (!gw || !cw || !rate || cw >= gw) return null;
    const netWeight = gw - cw;
    const totalPrice = gw * rate;
    const netPricePerKg = totalPrice / netWeight;
    return { netWeight, totalPrice, netPricePerKg };
  }, [grossWeight, coreWeight, ratePerKg]);

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    fontSize: "15px",
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    background: "#fff",
    color: "#1a1a2e",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    color: "#6b7280",
    marginBottom: "6px",
    textTransform: "uppercase",
  };

  const resultRow = (label, value, highlight = false) => (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: highlight ? "14px 18px" : "10px 18px",
      background: highlight ? "#1a1a2e" : "transparent",
      borderRadius: highlight ? "8px" : "0",
      borderBottom: !highlight ? "1px solid #f0f0f0" : "none",
    }}>
      <span style={{ fontSize: "13px", color: highlight ? "#a5b4fc" : "#6b7280", fontWeight: highlight ? "600" : "400", letterSpacing: "0.03em" }}>{label}</span>
      <span style={{ fontSize: highlight ? "18px" : "15px", fontWeight: "700", color: highlight ? "#fff" : "#1a1a2e", fontFamily: "monospace" }}>
        {value}
      </span>
    </div>
  );

  const hasError = grossWeight && coreWeight && parseFloat(coreWeight) >= parseFloat(grossWeight);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", marginBottom: "6px" }}>🎬</div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#1a1a2e", letterSpacing: "-0.02em" }}>
            Stretch Film Calculator
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#9ca3af" }}>
            Find the actual net price per kg of usable film
          </p>
        </div>

        {/* Input Card */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          marginBottom: "16px",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

            <div>
              <label style={labelStyle}>Gross Weight with Core (kg)</label>
              <input
                type="number"
                placeholder="e.g. 17.8"
                value={grossWeight}
                onChange={e => setGrossWeight(e.target.value)}
                style={inputStyle}
                min="0"
                step="0.1"
              />
            </div>

            <div>
              <label style={labelStyle}>Core Weight (kg)</label>
              <input
                type="number"
                placeholder="e.g. 2.8"
                value={coreWeight}
                onChange={e => setCoreWeight(e.target.value)}
                style={{ ...inputStyle, borderColor: hasError ? "#f87171" : "#d1d5db" }}
                min="0"
                step="0.1"
              />
              {hasError && (
                <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#ef4444" }}>
                  Core weight must be less than gross weight
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Rate per kg (₹)</label>
              <input
                type="number"
                placeholder="e.g. 165"
                value={ratePerKg}
                onChange={e => setRatePerKg(e.target.value)}
                style={inputStyle}
                min="0"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* Results Card */}
        {calc && (
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          }}>
            <div style={{ padding: "16px 18px 8px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.1em", color: "#9ca3af", textTransform: "uppercase" }}>
                Results
              </span>
            </div>

            {resultRow("Gross Weight", `${parseFloat(grossWeight).toFixed(2)} kg`)}
            {resultRow("Core Weight", `${parseFloat(coreWeight).toFixed(2)} kg`)}
            {resultRow("Net Film Weight", `${calc.netWeight.toFixed(2)} kg`)}
            {resultRow("Total Gross Price", `₹ ${formatINR(calc.totalPrice)}`)}
            <div style={{ padding: "10px 18px" }}>
              {resultRow("Net Price per kg", `₹ ${formatINR(calc.netPricePerKg)}`, true)}
            </div>
          </div>
        )}

        {!calc && !hasError && (grossWeight || coreWeight || ratePerKg) && (
          <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "13px" }}>
            Fill in all three fields to see results
          </div>
        )}

      </div>
    </div>
  );
}
